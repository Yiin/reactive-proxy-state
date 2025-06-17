import { StateEvent } from './types';

type EffectCallback<T = any> = (onCleanup?: (cleanupFn: () => void) => void) => T;
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
    
    // Run the effects at the current depth level
    for (const effect of effectsToRun) {
      if (effect.active) { // Double check the effect is still active
        if (effect.options?.scheduler) {
          effect.options.scheduler(effect.run);
        } else {
          effect.run();
        }
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
 * triggers all active effects associated with a specific object property.
 * called by proxy setters/deleters or ref setters.
 * now batches effects to run in the same tick.
 */
export function trigger(target: object, key: string | symbol): void {
  const depsMap = targetMap.get(target);
  if (!depsMap) return; // no effects tracked for this target

  // Increment the trigger depth when we start a new trigger cycle
  // This is used to batch effects by the level at which they were triggered
  currentTriggerDepth++;
  const triggerLevel = currentTriggerDepth;

  try {
    // helper to add effects from a specific dependency set to the queue
    const addEffects = (depKey: string | symbol) => {
      const dep = depsMap.get(depKey);
      if (dep) {
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
    };

    // add effects associated with the specific key that changed
    addEffects(key);
    // todo: consider adding effects associated with iteration keys (like Symbol.iterator or 'length' for arrays) if applicable

    // If we have queued effects, run them immediately
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  } finally {
    // Decrement the trigger depth when we're done with this trigger cycle
    currentTriggerDepth--;
  }
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
        // if stopped, potentially run the callback once without tracking, though behavior might be undefined
        // vue's behavior here might differ, review needed if exact compatibility matters
        try {
             return effectCallback();
        } catch (e) {
             console.error("error in stopped watchEffect callback:", e);
             // decide on return value for stopped effects that error
             return undefined as T; // or rethrow?
        }
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
