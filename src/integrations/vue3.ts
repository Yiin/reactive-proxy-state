import { deepClone, deepEqual, traverse } from "../utils";
import type { Path, StateEvent } from "../types";
import { watch } from "vue";
export type TrackVueReactiveEventsOptions = {
  emitInitialReplace?: boolean;
};

/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Returns a stop() function to tear down the watcher.
 */
export function trackVueReactiveEvents<T extends object>(
  vueState: T,
  emit: (event: StateEvent) => void,
  options: TrackVueReactiveEventsOptions = {}
): () => void {
  const { emitInitialReplace = true } = options;

  function isObject(v: any): v is object {
    return v && typeof v === "object";
  }

  if (emitInitialReplace) {
    try {
      emit({ action: "replace", path: [], newValue: deepClone(vueState) });
    } catch (e) {
      // ignore initial emit failures
    }
  }

  let prev = deepClone(vueState);

  const stop = watch(
    // Traverse to ensure deep dependency collection across nested structures
    () => traverse(vueState as any),
    () => {
      try {
        diffAndEmit(vueState as any, prev, []);
      } finally {
        prev = deepClone(vueState);
      }
    },
    { flush: 'sync' as any }
  );

  function diffAndEmit(curr: any, old: any, basePath: Path) {
    if (curr instanceof Date && old instanceof Date) {
      if (+curr !== +old) {
        emit({ action: 'set', path: basePath, oldValue: old, newValue: new Date(+curr) });
      }
      return;
    }
    if (Array.isArray(curr) && Array.isArray(old)) {
      diffArray(curr, old, basePath);
      return;
    }
    if (curr instanceof Map && old instanceof Map) {
      diffMap(curr, old, basePath);
      return;
    }
    if (curr instanceof Set && old instanceof Set) {
      diffSet(curr, old, basePath);
      return;
    }
    if (isObject(curr) && isObject(old)) {
      diffObject(curr, old, basePath);
      return;
    }
    if (!deepEqual(curr, old)) {
      emit({ action: 'set', path: basePath, oldValue: old, newValue: deepClone(curr) });
    }
  }

  function diffObject(curr: Record<string, any>, old: Record<string, any>, basePath: Path) {
    const keys = new Set([...Object.keys(curr), ...Object.keys(old)]);
    for (const k of keys) {
      const p = basePath.concat(k);
      if (!(k in curr)) {
        emit({ action: 'delete', path: p, oldValue: old[k] });
      } else if (!(k in old)) {
        emit({ action: 'set', path: p, newValue: deepClone(curr[k]) });
      } else {
        diffAndEmit(curr[k], old[k], p);
      }
    }
  }

  function diffArray(curr: any[], old: any[], basePath: Path) {
    const min = Math.min(curr.length, old.length);
    // Compare existing indices
    for (let i = 0; i < min; i++) {
      diffAndEmit(curr[i], old[i], basePath.concat(i));
    }
    if (curr.length > old.length) {
      // expand length first
      emit({ action: 'set', path: basePath.concat('length'), newValue: curr.length, oldValue: old.length });
      for (let i = old.length; i < curr.length; i++) {
        emit({ action: 'set', path: basePath.concat(i), newValue: deepClone(curr[i]) });
      }
    } else if (curr.length < old.length) {
      // shrink at end
      emit({ action: 'set', path: basePath.concat('length'), newValue: curr.length, oldValue: old.length });
    }
  }

  function diffMap(curr: Map<any, any>, old: Map<any, any>, basePath: Path) {
    // deletions
    for (const [k, v] of old.entries()) {
      if (!curr.has(k)) {
        emit({ action: 'map-delete', path: basePath, key: k, oldValue: v });
      }
    }
    // additions/changes
    for (const [k, v] of curr.entries()) {
      if (!old.has(k)) {
        emit({ action: 'map-set', path: basePath, key: k, newValue: deepClone(v) });
      } else if (!deepEqual(v, old.get(k))) {
        emit({ action: 'map-set', path: basePath, key: k, newValue: deepClone(v), oldValue: old.get(k) });
      }
    }
  }

  function diffSet(curr: Set<any>, old: Set<any>, basePath: Path) {
    for (const v of old.values()) {
      if (!curr.has(v)) emit({ action: 'set-delete', path: basePath, value: v, oldValue: v });
    }
    for (const v of curr.values()) {
      if (!old.has(v)) emit({ action: 'set-add', path: basePath, value: deepClone(v) });
    }
  }

  return stop;
}
