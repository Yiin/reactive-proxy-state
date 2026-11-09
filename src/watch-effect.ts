import { StateEvent } from './types';
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
  triggerDepth?: number; // tracks at what depth this effect was triggered (used for batching)
  cleanupFns?: (() => void)[]; // cleanup functions registered via onCleanup
}

// tracks the currently executing effect to establish dependencies
export let activeEffect: TrackedEffect<any> | null = null;

// batch processing for effects
let queuedEffects = new Map<TrackedEffect<any>, number>(); // Effect -> Trigger Depth
let isFlushing = false;
let currentTriggerDepth = 0; // Tracks how many nested trigger cycles we're in

// allows setting the active effect, used internally by the effect runner
export function setActiveEffect(effect: TrackedEffect<any> | null) {
  activeEffect = effect;
}

// storage for dependencies: target object -> property key -> set of effects that depend on this key
const targetMap = new WeakMap<object, Map<string | symbol, Set<TrackedEffect<any>>>>();

/**
 * removes an effect from all dependency sets it belongs to.
 * this is crucial to prevent memory leaks and unnecessary updates when an effect is stopped or re-run.
 */
export function cleanupEffect(effect: TrackedEffect<any>) {
  if (effect.dependencies) {
    effect.dependencies.forEach(dep => {
      // remove this effect from the dependency set associated with a specific target/key
      dep.delete(effect);
    });
    // clear the effect's own list of dependencies for the next run
    effect.dependencies.clear();
  }
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

/**
 * establishes a dependency between the currently active effect and a specific object property.
 * called by proxy getters or ref getters.
 */
export function track(target: object, key: string | symbol): void {
  // do nothing if there is no active effect or if the effect is stopped
  if (!activeEffect || !activeEffect.active) return;

  // get or create the dependency map for the target object
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  // get or create the set of effects for the specific property key
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  // add the current effect to the dependency set if it's not already there
  const effectToAdd: TrackedEffect<any> = activeEffect;
  if (!dep.has(effectToAdd)) {
    dep.add(effectToAdd);
    // also add this dependency set to the effect's own tracking list for cleanup purposes
    if (!effectToAdd.dependencies) {
      effectToAdd.dependencies = new Set();
    }
    effectToAdd.dependencies.add(dep);

    // trigger the onTrack debug hook if provided
    if (effectToAdd.options?.onTrack) {
        // pass the original user callback to the hook, not the internal wrapper
        effectToAdd.options.onTrack({ effect: effectToAdd._rawCallback, target, key, type: 'track' });
    }
  }
}

/**
 * Batch and execute all queued effects
 */
function flushEffects() {
  if (isFlushing) return;
  isFlushing = true;
  
  try {
    // Find the minimum depth in the current queue
    let minDepth = Infinity;
    for (const depth of queuedEffects.values()) {
      if (depth < minDepth) minDepth = depth;
    }
    
    // Special case for the "watchEffect handles self-mutation" test
    // Only run effects from the current depth level, leave effects from deeper levels for later
    const effectsToRun: TrackedEffect<any>[] = [];
    
    // Extract effects at the current depth level
    for (const [effect, depth] of queuedEffects.entries()) {
      if (depth === minDepth) {
        effectsToRun.push(effect);
        queuedEffects.delete(effect);
      }
    }
    
    // Run effects with a custom scheduler first (e.g., computed refs) so that
    // they can update their internal state (set dirty flags, enqueue
    // downstream triggers, etc.) before ordinary reactive effects run. This
    // guarantees that consumers reading computed values within the same flush
    // cycle will observe the latest value.

    // 1) Effects with a scheduler (like computed) – they *schedule* work.
    for (const effect of effectsToRun) {
      if (!effect.active) continue;
      if (effect.options?.scheduler) {
        effect.options.scheduler(effect.run);
      }
    }

    // 2) Effects without a scheduler – typical reactive/watch effects.
    for (const effect of effectsToRun) {
      if (!effect.active) continue;
      if (!effect.options?.scheduler) {
        effect.run();
      }
    }
  } finally {
    isFlushing = false;
    
    // If more effects were queued during execution, schedule another flush
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  }
}

/**
 * Queue the effects of `dep`, the effects that read `key` of `target`, at
 * trigger depth `triggerLevel`.
 */
function queueEffects(
  dep: Set<TrackedEffect<any>> | undefined,
  target: object,
  key: string | symbol,
  triggerLevel: number
): void {
  if (dep === undefined) return;
  dep.forEach(effect => {
    // avoid queuing the effect if it's the one currently running (prevents infinite loops)
    // also ensure the effect hasn't been stopped
    if (effect !== activeEffect && effect.active) {
      // Trigger the onTrigger debug hook if provided
      if (effect.options?.onTrigger) {
        effect.options.onTrigger({ effect: effect._rawCallback, target, key, type: 'trigger' });
      }

      // Store or update the effect with the current trigger depth
      // Only update if the new depth is lower (higher priority)
      if (!queuedEffects.has(effect) || triggerLevel < queuedEffects.get(effect)!) {
        queuedEffects.set(effect, triggerLevel);
      }
    }
  });
}

/**
 * triggers all active effects associated with a specific object property,
 * and with `otherKey` when given. An effect that read both runs once.
 * called by proxy setters/deleters or ref setters.
 */
export function trigger(target: object, key: string | symbol, otherKey?: string | symbol): void {
  const depsMap = targetMap.get(target);
  if (!depsMap) return; // no effects tracked for this target

  // Increment the trigger depth when we start a new trigger cycle
  // This is used to batch effects by the level at which they were triggered
  const triggerLevel = ++currentTriggerDepth;

  try {
    queueEffects(depsMap.get(key), target, key, triggerLevel);
    if (otherKey !== undefined) queueEffects(depsMap.get(otherKey), target, otherKey, triggerLevel);

    // If we have queued effects, run them immediately
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  } finally {
    // Decrement the trigger depth when we're done with this trigger cycle
    currentTriggerDepth--;
  }
}

/**
 * Triggers the effects that read what a write changed in the array
 * `target`: each index from `from` up to `to`, `length` when
 * `lengthChanged`, and the array as a whole, the `Symbol.iterator` key that
 * every reader of all items tracks (`map`, `filter`, `indexOf`, `for...of`
 * and the rest), so it also runs on every length change. With `before`,
 * the array as it was, an index that holds what it held is skipped. Each
 * effect runs once.
 */
export function triggerArray(
  target: unknown[],
  from: number,
  to: number,
  lengthChanged: boolean,
  before?: readonly unknown[]
): void {
  const depsMap = targetMap.get(target);
  if (!depsMap) return; // no effects tracked for this target

  const triggerLevel = ++currentTriggerDepth;

  try {
    if (to - from <= depsMap.size) {
      for (let index = from; index < to; index++) {
        if (before !== undefined && sameAt(before, target, index)) continue;
        const key = String(index);
        queueEffects(depsMap.get(key), target, key, triggerLevel);
      }
    } else {
      // a wide range: look only at the indexes effects read
      depsMap.forEach((dep, key) => {
        const index = arrayIndex(key);
        if (index < from || index >= to) return;
        if (before !== undefined && sameAt(before, target, index)) return;
        queueEffects(dep, target, key, triggerLevel);
      });
    }
    if (lengthChanged) queueEffects(depsMap.get("length"), target, "length", triggerLevel);
    queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator, triggerLevel);

    if (queuedEffects.size > 0) {
      flushEffects();
    }
  } finally {
    currentTriggerDepth--;
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
  onTrack?: (event: { effect: EffectCallback<any>; target: object; key: string | symbol; type: 'track' }) => void; // debug hook called when a dependency is tracked
  onTrigger?: (event: { effect: EffectCallback<any>; target: object; key: string | symbol; type: 'trigger' }) => void; // debug hook called when the effect is triggered
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
    try {
      // Run cleanup functions before re-running the effect
      runCleanupFunctions(effectFn);
      
      cleanupEffect(effectFn); // clean up dependencies from the previous run
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
    }
  };

  // create the internal effect object
  const effectFn: TrackedEffect<T> = {
      run: run,
      dependencies: new Set(), // initialize empty dependencies
      options: options,
      active: true, // start as active
      _rawCallback: effectCallback, // store the original callback
      cleanupFns: [] // initialize cleanup functions
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
      effectFn.active = false; // mark as inactive
      // Remove from queued effects if present
      queuedEffects.delete(effectFn);
    }
  };

  // attach the effect instance to the stop handle for potential advanced usage
  stopHandle.effect = effectFn;

  return stopHandle;
}
