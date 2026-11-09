import { arrayIndex } from './utils';

type EffectCallback<T = any> = (onCleanup: (cleanupFn: () => void) => void) => T;
type Scheduler = (job: () => void) => void;

// stop handle returned by watchEffect, allows stopping the effect
// also exposes the internal effect instance for advanced use cases
export interface WatchEffectStopHandle<T = any> {
  (): void; // stop function
  effect: TrackedEffect<T>; // the internal effect instance
}

// internal representation of a reactive effect
export interface TrackedEffect<T = any> {
  run: () => T; // function to execute the effect, handling cleanup and activeEffect management
  dependencies?: Set<Set<TrackedEffect<any>>>; // tracks which dependency sets this effect belongs to, used for cleanup
  options?: WatchEffectOptions;
  active?: boolean; // flag indicating if the effect is currently active (not stopped)
  _rawCallback: EffectCallback<T>; // the original user-provided callback function
  cleanupFns?: (() => void)[]; // cleanup functions registered via onCleanup
  /**
   * Set on the effect of a computed: marks its value stale and triggers its
   * readers, inside the batch of the write.
   * @internal
   */
  invalidate?: () => void;
  /** Waiting in the flush queue. @internal */
  queued?: boolean;
  /** The flush that last ran it. @internal */
  flushId?: number;
  /** How many times it ran in that flush. @internal */
  flushRuns?: number;
}

// tracks the currently executing effect to establish dependencies
export let activeEffect: TrackedEffect<any> | null = null;

// allows setting the active effect, used internally by the effect runner
export function setActiveEffect(effect: TrackedEffect<any> | null) {
  activeEffect = effect;
}

/**
 * The effects that read one key of one target, and the map that holds it
 * under that key, so the last effect to leave can remove it.
 */
class Dep extends Set<TrackedEffect<any>> {
  constructor(readonly owner: Map<unknown, Dep>, readonly key: unknown) {
    super();
  }
}

// storage for dependencies: target object -> property key -> the effects that read it
const targetMap = new WeakMap<object, Map<unknown, Dep>>();
// the same for the entries of Maps and Sets: collection -> Map key or Set value -> the
// effects that read it with get or has. Apart from `targetMap`, so an entry never
// shares a dependency with a property ("get", "size"), and keyed by the entry itself,
// as the collection keys it (1 and "1" are two entries, NaN is one)
const entryMap = new WeakMap<object, Map<unknown, Dep>>();

/**
 * Dependencies a cleanup at the start of a run left without effects, the
 * first `emptiedCount` slots. The run tracks most of them again; when it
 * ends it removes the ones still empty (see `releaseEmptied`), so a rerun
 * does not remove and remake them. The array keeps its length: setting it
 * shorter after every run made a one-key rerun 40% slower.
 */
const emptiedDeps: (Dep | undefined)[] = [];
let emptiedCount = 0;

/**
 * Remove `dep` from its map when no effect reads it. A map left empty stays
 * in `targetMap` or `entryMap` until the next write to its target (see
 * `depsOf`) or until the target is collected: a dependency keeps no
 * reference to its target, so an effect never keeps one alive.
 */
function releaseDep(dep: Dep): void {
  if (dep.size === 0 && dep.owner.get(dep.key) === dep) dep.owner.delete(dep.key);
}

function releaseEmptied(from: number): void {
  for (let i = from; i < emptiedCount; i++) {
    releaseDep(emptiedDeps[i]!);
    emptiedDeps[i] = undefined;
  }
  emptiedCount = from;
  // a run that read very many keys does not keep its slots
  if (from === 0 && emptiedDeps.length > 4096) emptiedDeps.length = 0;
}

/** The dependencies of `target`, or undefined when no effect reads it. */
function depsOf(maps: WeakMap<object, Map<unknown, Dep>>, target: object): Map<unknown, Dep> | undefined {
  const deps = maps.get(target);
  if (deps === undefined || deps.size > 0) return deps;
  maps.delete(target);
  return undefined;
}

/**
 * The dependency sets of `target`, by kind, for tests: undefined where it
 * has no map.
 * @internal
 */
export function dependencyCounts(target: object): { properties?: number; entries?: number } {
  return { properties: targetMap.get(target)?.size, entries: entryMap.get(target)?.size };
}

/**
 * Take `effect` out of every dependency it is in. With `defer`, the ones it
 * leaves empty go to `emptiedDeps`, else they are removed at once.
 */
function detachEffect(effect: TrackedEffect<any>, defer: boolean): void {
  const dependencies = effect.dependencies as Set<Dep> | undefined;
  if (dependencies === undefined || dependencies.size === 0) return;
  dependencies.forEach(dep => {
    dep.delete(effect);
    if (dep.size > 0) return;
    if (defer) emptiedDeps[emptiedCount++] = dep;
    else releaseDep(dep);
  });
  dependencies.clear();
}

/**
 * removes an effect from all dependency sets it belongs to, and each set it
 * leaves empty from its map.
 * this is crucial to prevent memory leaks and unnecessary updates when an effect is stopped or re-run.
 */
export function cleanupEffect(effect: TrackedEffect<any>) {
  detachEffect(effect, false);
}

/**
 * runs all cleanup functions registered for an effect and clears them.
 * called before re-running an effect or when stopping it.
 */
export function runCleanupFunctions(effect: TrackedEffect<any>) {
  if (effect.cleanupFns && effect.cleanupFns.length > 0) {
    effect.cleanupFns.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (error) {
        console.error('Error in effect cleanup function:', error);
      }
    });
    effect.cleanupFns = []; // clear cleanup functions after running them
  }
}

/** The dependency for `key` of `target` in `maps`, made when missing. */
function depFor(maps: WeakMap<object, Map<unknown, Dep>>, target: object, key: unknown): Dep {
  let deps = maps.get(target);
  if (deps === undefined) {
    deps = new Map();
    maps.set(target, deps);
  }
  let dep = deps.get(key);
  if (dep === undefined) {
    dep = new Dep(deps, key);
    deps.set(key, dep);
  }
  return dep;
}

/** Add the active effect to `dep`, the effects that read `key` of `target`. */
function addDep(dep: Dep, target: object, key: unknown): void {
  const effect = activeEffect!;
  if (dep.has(effect)) return;
  dep.add(effect);
  // also add this dependency set to the effect's own tracking list for cleanup purposes
  if (!effect.dependencies) {
    effect.dependencies = new Set();
  }
  effect.dependencies.add(dep);

  // trigger the onTrack debug hook if provided
  if (effect.options?.onTrack) {
    // pass the original user callback to the hook, not the internal wrapper
    effect.options.onTrack({ effect: effect._rawCallback, target, key, type: 'track' });
  }
}

/**
 * establishes a dependency between the currently active effect and a specific object property.
 * called by proxy getters or ref getters.
 */
export function track(target: object, key: string | symbol): void {
  // do nothing if there is no active effect or if the effect is stopped
  if (!activeEffect || !activeEffect.active) return;
  addDep(depFor(targetMap, target, key), target, key);
}

/**
 * Tracks a read of one entry of the Map or Set `target`: `get` or `has` of
 * `entry`, a Map key or a Set value.
 * @internal
 */
export function trackEntry(target: object, entry: unknown): void {
  if (!activeEffect || !activeEffect.active) return;
  addDep(depFor(entryMap, target, entry), target, entry);
}

/**
 * The key a traversal (deep `watch`) tracks on an object: a key added to
 * or deleted from the object triggers it, also when the traversal read no
 * key because the object had none.
 */
const keysKey = Symbol('keys');

/**
 * Tracks the keys of the plain object `target`: the active effect reruns
 * when a key is added or deleted (see `triggerKeyChange`).
 * @internal
 */
export function trackKeys(target: object): void {
  track(target, keysKey);
}

// the queue of effects to run: each effect is in it at most once while it waits
const queue: TrackedEffect<any>[] = [];
let flushing = false;
// open trigger calls: effects run when the outermost one ends
let batchDepth = 0;
let flushCount = 0;

/**
 * Runs of one effect in one flush that make it a loop: effects that write
 * what other effects read, each time a new value. 3.0.2 ran out of stack
 * after about 7,000 rounds under Node.
 */
const MAX_FLUSH_RUNS = 100_000;

/**
 * Run the queued effects, in the order they were queued. An effect queued
 * again while it waits runs once; an effect that already ran is queued
 * again by a later write, and runs again. An effect that throws does not
 * stop the others: after the queue is empty the first error is thrown.
 */
function flushEffects(): void {
  flushing = true;
  const flushId = ++flushCount;
  let failed = false;
  let failure: unknown;
  let index = 0;
  try {
    for (; index < queue.length; index++) {
      const effect = queue[index];
      effect.queued = false;
      if (!effect.active) continue;
      const runs = effect.flushId === flushId ? effect.flushRuns! + 1 : 1;
      effect.flushId = flushId;
      effect.flushRuns = runs;
      if (runs > MAX_FLUSH_RUNS) {
        if (!failed) {
          failed = true;
          failure = new RangeError(
            `reactive-proxy-state: an effect ran ${MAX_FLUSH_RUNS} times in one flush. ` +
            `Effects that write what other effects read loop when each write is new`
          );
        }
        index++;
        break;
      }
      try {
        const scheduler = effect.options?.scheduler;
        if (scheduler) scheduler(effect.run);
        else effect.run();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  } finally {
    // effects a loop left in the queue are no longer waiting
    for (; index < queue.length; index++) queue[index].queued = false;
    queue.length = 0;
    flushing = false;
  }
  if (failed) throw failure;
}

function startBatch(): void {
  batchDepth++;
}

/** End a trigger call; the outermost one runs what the batch queued, unless a flush is running. */
function endBatch(): void {
  if (--batchDepth === 0 && !flushing && queue.length > 0) flushEffects();
}

/**
 * Queue the effects of `dep`, the effects that read `key` of `target`. The
 * effect of a computed is not queued: it marks its value stale and
 * triggers its own readers now, so every computed a write makes stale is
 * stale before any effect runs.
 */
function queueEffects(dep: Dep | undefined, target: object, key: unknown): void {
  if (dep === undefined) return;
  dep.forEach(effect => {
    // avoid queuing the effect if it's the one currently running (prevents infinite loops)
    // also ensure the effect hasn't been stopped
    if (effect === activeEffect || !effect.active) return;
    // Trigger the onTrigger debug hook if provided
    if (effect.options?.onTrigger) {
      effect.options.onTrigger({ effect: effect._rawCallback, target, key, type: 'trigger' });
    }
    if (effect.invalidate !== undefined) {
      effect.invalidate();
    } else if (!effect.queued) {
      effect.queued = true;
      queue.push(effect);
    }
  });
}

/**
 * triggers all active effects associated with a specific object property.
 * called by proxy setters/deleters or ref setters.
 */
export function trigger(target: object, key: string | symbol): void {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap) return; // no effects tracked for this target
  startBatch();
  try {
    queueEffects(depsMap.get(key), target, key);
  } finally {
    endBatch();
  }
}

/**
 * Triggers every effect that read a key of the object `target`, once each:
 * a key was added or deleted, which changes what `JSON.stringify`, spread,
 * `Object.entries`, `Object.values` and a deep `watch` read. There is no
 * `ownKeys` or `has` trap, which made reads slower for every caller, so an
 * effect that read only `Object.keys`, `in` or a `for...in` of keys is not
 * triggered.
 * @internal
 */
export function triggerKeyChange(target: object): void {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap) return;
  startBatch();
  try {
    depsMap.forEach((dep, key) => queueEffects(dep, target, key));
  } finally {
    endBatch();
  }
}

/**
 * Queue the effects that read an index of `target` from `from` up to `to`,
 * except the indexes `same` says hold what they held.
 */
function queueIndexes(
  depsMap: Map<unknown, Dep>,
  target: unknown[],
  from: number,
  to: number,
  same: ((index: number) => boolean) | undefined
): void {
  if (to - from <= depsMap.size) {
    for (let index = from; index < to; index++) {
      const key = String(index);
      const dep = depsMap.get(key);
      if (dep === undefined || (same !== undefined && same(index))) continue;
      queueEffects(dep, target, key);
    }
  } else {
    // a wide range: look only at the indexes effects read
    depsMap.forEach((dep, key) => {
      const index = arrayIndex(key as string | symbol);
      if (index < from || index >= to) return;
      if (same !== undefined && same(index)) return;
      queueEffects(dep, target, key);
    });
  }
}

/** Queue the readers of `length` when it changed, and of all items (`Symbol.iterator`). */
function queueWhole(depsMap: Map<unknown, Dep>, target: unknown[], lengthChanged: boolean): void {
  if (lengthChanged) queueEffects(depsMap.get("length"), target, "length");
  queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator);
}

/**
 * Triggers the effects that read what a write changed in the array
 * `target`: each index from `from` up to `to`, `length` when
 * `lengthChanged`, and the array as a whole, the `Symbol.iterator` key that
 * every reader of all items tracks (`map`, `filter`, `indexOf`, `for...of`
 * and the rest), so it also runs on every length change. With `before`,
 * the array as it was, an index that holds what it held is skipped. Each
 * effect runs once.
 * @internal
 */
export function triggerArray(
  target: unknown[],
  from: number,
  to: number,
  lengthChanged: boolean,
  before?: readonly unknown[]
): void {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap) return; // no effects tracked for this target
  startBatch();
  try {
    queueIndexes(depsMap, target, from, to, before === undefined ? undefined : index => sameAt(before, target, index));
    queueWhole(depsMap, target, lengthChanged);
  } finally {
    endBatch();
  }
}

/**
 * Triggers the effects that read what a splice changed in the array
 * `target`: from `start`, the `removed` items (holes kept) gave way to
 * `inserted` items, and the items after them moved, from an array
 * `oldLength` long. `shift` and `unshift` are splices at 0. An index that
 * holds the value it held, as `Object.is` tells, and the same hole or not,
 * is skipped. Each effect runs once.
 * @internal
 */
export function triggerSplice(
  target: unknown[],
  start: number,
  removed: readonly unknown[],
  inserted: number,
  oldLength: number
): void {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap) return;
  const newLength = target.length;
  const removedEnd = start + removed.length;
  // where the item at an index after the change was before it
  const moved = removed.length - inserted;
  // a change that keeps the count moves nothing after it
  const end = moved === 0 ? removedEnd : Math.max(oldLength, newLength);
  const same = (index: number): boolean => {
    let had: boolean;
    let held: unknown;
    if (index < removedEnd) {
      had = index - start in removed;
      held = removed[index - start];
    } else if (index < oldLength) {
      // the item now at `index - moved` was at `index`
      const now = index - moved;
      had = now in target;
      held = target[now];
    } else {
      had = false;
      held = undefined;
    }
    return Object.is(held, target[index]) && had === index in target;
  };
  // items replaced by the same items change nothing
  if (moved === 0 && unchanged(start, end, same)) return;
  startBatch();
  try {
    queueIndexes(depsMap, target, start, end, same);
    queueWhole(depsMap, target, oldLength !== newLength);
  } finally {
    endBatch();
  }
}

/** Does `same` hold for every index from `from` up to `to`? */
function unchanged(from: number, to: number, same: (index: number) => boolean): boolean {
  for (let index = from; index < to; index++) {
    if (!same(index)) return false;
  }
  return true;
}

/**
 * Triggers the effects that read what a write changed in the Map or Set
 * `target`: the entry `entry` (a Map key or a Set value), the collection as
 * a whole (`Symbol.iterator`), and `size` when `sizeChanged`. Each effect
 * runs once.
 * @internal
 */
export function triggerCollection(target: object, entry: unknown, sizeChanged: boolean): void {
  const depsMap = depsOf(targetMap, target);
  const entryDeps = depsOf(entryMap, target);
  if (!depsMap && !entryDeps) return; // no effects tracked for this target
  startBatch();
  try {
    if (entryDeps) queueEffects(entryDeps.get(entry), target, entry);
    if (depsMap) {
      if (sizeChanged) queueEffects(depsMap.get("size"), target, "size");
      queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator);
    }
  } finally {
    endBatch();
  }
}

/**
 * Triggers the effects that read what `clear()` removed from the Map or Set
 * `target`: each entry of `removed` (its key: a Map key, or a Set value),
 * the collection as a whole and its size. Each effect runs once.
 * @internal
 */
export function triggerCleared(target: object, removed: readonly unknown[]): void {
  const depsMap = depsOf(targetMap, target);
  const entryDeps = depsOf(entryMap, target);
  if (!depsMap && !entryDeps) return; // no effects tracked for this target
  startBatch();
  try {
    if (entryDeps) {
      for (let i = 0; i < removed.length; i++) queueEffects(entryDeps.get(removed[i]), target, removed[i]);
    }
    if (depsMap) {
      queueEffects(depsMap.get("size"), target, "size");
      queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator);
    }
  } finally {
    endBatch();
  }
}

/** Does `index` hold the same value in `before` and `after`, as `Object.is` tells, and the same hole or not? */
function sameAt(before: readonly unknown[], after: readonly unknown[], index: number): boolean {
  return Object.is(before[index], after[index]) && index in before === index in after;
}

// options for configuring watchEffect behavior
export interface WatchEffectOptions {
  lazy?: boolean; // if true, the effect does not run immediately upon creation
  scheduler?: Scheduler; // custom function to control how/when the effect runs after a trigger
  // debug hook called when a dependency is tracked. `key` is a property name, or the
  // Map key or Set value that `get` or `has` read
  onTrack?: (event: { effect: EffectCallback<any>; target: object; key: unknown; type: 'track' }) => void;
  // debug hook called when the effect is triggered; `key` as in onTrack
  onTrigger?: (event: { effect: EffectCallback<any>; target: object; key: unknown; type: 'trigger' }) => void;
}

/**
 * runs a function immediately, tracks its reactive dependencies, and re-runs it
 * synchronously whenever any of those dependencies change.
 * returns a stop handle to manually stop the effect.
 */
export function watchEffect<T>(
  effectCallback: EffectCallback<T>,
  options: WatchEffectOptions = {}
): WatchEffectStopHandle<T> {

  // the wrapper function that manages the effect lifecycle (cleanup, tracking, execution)
  const run = (): T => {
    if (!effectFn.active) {
        throw new Error("Trying to run a stopped effect");
    }

    const previousEffect = activeEffect;
    const emptiedFrom = emptiedCount;
    try {
      // Run cleanup functions before re-running the effect
      runCleanupFunctions(effectFn);

      // clean up dependencies from the previous run; the ones this run
      // does not read again are removed when it ends
      detachEffect(effectFn, true);
      setActiveEffect(effectFn); // set this effect as the one currently tracking

      // Create the onCleanup function that the user callback can use
      const onCleanup = (cleanupFn: () => void) => {
        if (!effectFn.cleanupFns) {
          effectFn.cleanupFns = [];
        }
        effectFn.cleanupFns.push(cleanupFn);
      };

      return effectCallback(onCleanup); // execute the user's function with onCleanup, triggering tracks
    } finally {
      setActiveEffect(previousEffect); // restore the previous active effect
      releaseEmptied(emptiedFrom);
    }
  };

  // create the internal effect object
  const effectFn: TrackedEffect<T> = {
      run: run,
      dependencies: new Set(), // initialize empty dependencies
      options: options,
      active: true, // start as active
      _rawCallback: effectCallback, // store the original callback
      cleanupFns: [], // initialize cleanup functions
      invalidate: undefined,
      queued: false,
      flushId: 0,
      flushRuns: 0,
  };

  // run the effect immediately unless the `lazy` option is true
  if (!options.lazy) {
    effectFn.run();
  }

  // create the function that stops the effect
  const stopHandle: WatchEffectStopHandle<T> = () => {
    if (effectFn.active) {
      runCleanupFunctions(effectFn); // run any registered cleanup functions
      cleanupEffect(effectFn); // remove from dependency lists
      effectFn.active = false; // mark as inactive; a flush skips it
    }
  };

  // attach the effect instance to the stop handle for potential advanced usage
  stopHandle.effect = effectFn;

  return stopHandle;
}
