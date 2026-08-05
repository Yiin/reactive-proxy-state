import { deepClone, deepEqual } from "../utils";
import type { Path, StateEvent } from "../types";
import { watchEffect } from "vue";
import { pauseTracking, resetTracking } from "@vue/reactivity";

export type DiffErrorContext = {
  key: string;
  path: (string | number | symbol)[];
  error: unknown;
};

export type TrackVueReactiveEventsOptions = {
  emitInitialReplace?: boolean;
  onDiffError?: (ctx: DiffErrorContext) => void;
};

export type VueTrackingControl = {
  /** Stop all effects permanently. */
  stop: () => void;
  /** Stop all effects temporarily. No diffing overhead while paused. */
  pause: () => void;
  /** Rebuild snapshots from current state and re-create effects. */
  resume: () => void;
};

/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Uses per-key watchEffect partitioning: one effect per root key so that
 * only the affected subtree is diffed on mutation. A root structural effect
 * tracks Object.keys() for key add/delete at the top level.
 *
 * Returns a control object with stop/pause/resume. Use pause/resume to
 * suppress diffing while applying external mutations (e.g. server events).
 */
export function trackVueReactiveEvents<T extends object>(
  vueState: T,
  emit: (event: StateEvent) => void,
  options: TrackVueReactiveEventsOptions = {}
): VueTrackingControl {
  const { emitInitialReplace = true, onDiffError } = options;

  if (emitInitialReplace) {
    try {
      emit({ action: "replace", path: [], newValue: deepClone(vueState) });
    } catch (e) {
      // ignore initial emit failures
    }
  }

  const prev: Record<string, any> = {};
  const pathStack: (string | number | symbol)[] = [];
  const keyStops = new Map<string, () => void>();
  let rootStop: (() => void) | null = null;

  // Initialize prev snapshot (outside any effect — no accidental dep tracking)
  for (const k of Object.keys(vueState)) {
    prev[k] = deepClone((vueState as any)[k]);
  }

  function createKeyEffect(k: string) {
    const stop = watchEffect(() => {
      // Check existence through proxy (tracks 'has' dep)
      if (!(k in (vueState as any))) return;

      const currVal = (vueState as any)[k];
      pathStack.push(k);
      try {
        const result = diffAndClone(currVal, prev[k], pathStack, emit);
        if (result !== prev[k]) {
          prev[k] = result;
        }
      } catch (e) {
        const errorPath = pathStack.slice();
        pathStack.length = 0;
        prev[k] = deepClone((vueState as any)[k]);
        if (onDiffError) {
          onDiffError({ key: k, path: errorPath, error: e });
        }
        return;
      }
      pathStack.pop();
    }, { flush: 'sync' as any });
    keyStops.set(k, stop);
  }

  function createRootEffect() {
    rootStop = watchEffect(() => {
      const currKeys = Object.keys(vueState as any);
      const currKeySet = new Set(currKeys);
      const prevKeySet = new Set(Object.keys(prev));

      // Added keys
      for (const k of currKeys) {
        if (!prevKeySet.has(k)) {
          pauseTracking();
          const cloned = deepClone((vueState as any)[k]);
          resetTracking();

          pathStack.push(k);
          emit({ action: 'set', path: pathStack.slice(), newValue: cloned });
          pathStack.pop();

          prev[k] = cloned;
          createKeyEffect(k);
        }
      }

      // Deleted keys
      for (const k of prevKeySet) {
        if (!currKeySet.has(k)) {
          pathStack.push(k);
          emit({ action: 'delete', path: pathStack.slice(), oldValue: prev[k] });
          pathStack.pop();

          delete prev[k];
          keyStops.get(k)?.();
          keyStops.delete(k);
        }
      }
    }, { flush: 'sync' as any });
  }

  function stopAll() {
    rootStop?.();
    rootStop = null;
    for (const stop of keyStops.values()) stop();
    keyStops.clear();
  }

  function startAll() {
    for (const k of Object.keys(prev)) {
      createKeyEffect(k);
    }
    createRootEffect();
  }

  // Initial setup
  startAll();

  return {
    stop: stopAll,
    pause: stopAll,
    resume() {
      // Refresh snapshots from current state (outside effects — no dep tracking)
      const currentKeys = new Set(Object.keys(vueState as any));
      for (const k of Object.keys(prev)) {
        if (!currentKeys.has(k)) delete prev[k];
      }
      for (const k of currentKeys) {
        prev[k] = deepClone((vueState as any)[k]);
      }
      // Re-create effects (run immediately, establishing fresh deps)
      startAll();
    }
  };
}

function typeTag(v: any): string {
  if (v === null || typeof v !== 'object') return 'primitive';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Map) return 'map';
  if (v instanceof Set) return 'set';
  if (v instanceof Date) return 'date';
  return 'object';
}

/**
 * Unified diff + clone pass with structural sharing.
 * Returns the new `prev` snapshot. Unchanged subtrees reuse the old reference.
 */
function diffAndClone(
  curr: any,
  old: any,
  pathStack: (string | number | symbol)[],
  emit: (event: StateEvent) => void
): any {
  // Primitive or null — quick === check
  if (curr === null || typeof curr !== 'object') {
    if (curr !== old) {
      emit({ action: 'set', path: pathStack.slice(), oldValue: old, newValue: curr });
    }
    return curr;
  }

  // Type transition — emit full set replacement
  if (typeTag(curr) !== typeTag(old)) {
    emit({ action: 'set', path: pathStack.slice(), oldValue: old, newValue: deepClone(curr) });
    return deepClone(curr);
  }

  // Date
  if (curr instanceof Date) {
    if (!(old instanceof Date) || +curr !== +old) {
      emit({ action: 'set', path: pathStack.slice(), oldValue: old, newValue: new Date(+curr) });
      return new Date(+curr);
    }
    return old;
  }

  // Array
  if (Array.isArray(curr)) {
    return diffAndCloneArray(curr, old, pathStack, emit);
  }

  // Map
  if (curr instanceof Map) {
    return diffAndCloneMap(curr, old as Map<any, any>, pathStack, emit);
  }

  // Set
  if (curr instanceof Set) {
    return diffAndCloneSet(curr, old as Set<any>, pathStack, emit);
  }

  // Plain object
  return diffAndCloneObject(curr, old, pathStack, emit);
}

function diffAndCloneObject(
  curr: Record<string, any>,
  old: Record<string, any>,
  pathStack: (string | number | symbol)[],
  emit: (event: StateEvent) => void
): Record<string, any> {
  const currKeys = Object.keys(curr);
  const oldKeys = Object.keys(old);
  let changed = false;
  let result: Record<string, any> | null = null;

  // Check for deleted keys
  for (let i = 0; i < oldKeys.length; i++) {
    const k = oldKeys[i];
    if (!(k in curr)) {
      if (!changed) { changed = true; result = { ...old }; }
      pathStack.push(k);
      emit({ action: 'delete', path: pathStack.slice(), oldValue: old[k] });
      pathStack.pop();
      delete result![k];
    }
  }

  // Check existing + added keys
  for (let i = 0; i < currKeys.length; i++) {
    const k = currKeys[i];
    if (!(k in old)) {
      // Added key
      if (!changed) { changed = true; result = { ...old }; }
      pathStack.push(k);
      emit({ action: 'set', path: pathStack.slice(), newValue: deepClone(curr[k]) });
      pathStack.pop();
      result![k] = deepClone(curr[k]);
    } else {
      // Existing key — recurse
      pathStack.push(k);
      const childResult = diffAndClone(curr[k], old[k], pathStack, emit);
      pathStack.pop();
      if (childResult !== old[k]) {
        if (!changed) { changed = true; result = { ...old }; }
        result![k] = childResult;
      }
    }
  }

  return changed ? result! : old;
}

function diffAndCloneArray(
  curr: any[],
  old: any[],
  pathStack: (string | number | symbol)[],
  emit: (event: StateEvent) => void
): any[] {
  const min = Math.min(curr.length, old.length);
  let changed = false;
  let result: any[] | null = null;

  // Compare overlapping indices
  for (let i = 0; i < min; i++) {
    pathStack.push(i);
    const childResult = diffAndClone(curr[i], old[i], pathStack, emit);
    pathStack.pop();
    if (childResult !== old[i]) {
      if (!changed) { changed = true; result = old.slice(); }
      result![i] = childResult;
    }
  }

  if (curr.length > old.length) {
    // Array grew — emit only per-index sets; no length event (would leave a hole on the remote)
    if (!changed) { changed = true; result = old.slice(); }
    result!.length = curr.length;
    for (let i = old.length; i < curr.length; i++) {
      pathStack.push(i);
      emit({ action: 'set', path: pathStack.slice(), newValue: deepClone(curr[i]) });
      pathStack.pop();
      result![i] = deepClone(curr[i]);
    }
  } else if (curr.length < old.length) {
    // Array shrank
    if (!changed) { changed = true; result = old.slice(); }
    pathStack.push('length');
    emit({ action: 'set', path: pathStack.slice(), newValue: curr.length, oldValue: old.length });
    pathStack.pop();
    result!.length = curr.length;
  }

  return changed ? result! : old;
}

function diffAndCloneMap(
  curr: Map<any, any>,
  old: Map<any, any>,
  pathStack: (string | number | symbol)[],
  emit: (event: StateEvent) => void
): Map<any, any> {
  let changed = false;
  let result: Map<any, any> | null = null;
  const path = pathStack.slice(); // Map events use the map's own path

  // Deletions
  for (const [k, v] of old.entries()) {
    if (!curr.has(k)) {
      if (!changed) { changed = true; result = new Map(old); }
      emit({ action: 'map-delete', path, key: k, oldValue: v });
      result!.delete(k);
    }
  }

  // Additions / changes
  for (const [k, v] of curr.entries()) {
    // Always clone through the reactive proxy to establish deps on nested properties.
    // Using deepEqual(reactiveProxy, plainClone) directly would hit a stale memoization
    // cache from the initial watchEffect run, skipping reactive reads.
    const vClone = deepClone(v);
    if (!old.has(k)) {
      if (!changed) { changed = true; result = new Map(old); }
      emit({ action: 'map-set', path, key: k, newValue: vClone });
      result!.set(k, vClone);
    } else if (!deepEqual(vClone, old.get(k), new WeakMap())) {
      if (!changed) { changed = true; result = new Map(old); }
      emit({ action: 'map-set', path, key: k, newValue: vClone, oldValue: old.get(k) });
      result!.set(k, vClone);
    }
  }

  return changed ? result! : old;
}

function diffAndCloneSet(
  curr: Set<any>,
  old: Set<any>,
  pathStack: (string | number | symbol)[],
  emit: (event: StateEvent) => void
): Set<any> {
  let changed = false;
  let result: Set<any> | null = null;
  const path = pathStack.slice();

  for (const v of old.values()) {
    if (!curr.has(v)) {
      if (!changed) { changed = true; result = new Set(old); }
      emit({ action: 'set-delete', path, value: v, oldValue: v });
      result!.delete(v);
    }
  }

  for (const v of curr.values()) {
    if (!old.has(v)) {
      if (!changed) { changed = true; result = new Set(old); }
      emit({ action: 'set-add', path, value: deepClone(v) });
      result!.add(deepClone(v));
    }
  }

  return changed ? result! : old;
}
