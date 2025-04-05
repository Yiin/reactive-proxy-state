import { StateEvent, Path, EmitFunction } from './types';
import { deepEqual } from './utils';
import { watchEffect } from './watchEffect';
import { traverse, deepClone } from './utils';

type WatchCallback<T = any> = (newValue: T, oldValue: T | undefined) => void;
type WatchSource<T = any> = () => T;
// Allow source to be an object directly
type WatchSourceInput<T = any> = WatchSource<T> | T;
type WatchStopHandle = () => void;

// Global registry of watchers
// interface WatcherRecord { ... }
// const watchers: WatcherRecord[] = [];
/* 
export function notifyStateChange(state: object, event: StateEvent): void {
  // Run all active watchers
  for (const watcher of watchers) {
    if (!watcher.active) continue;
    
    // Get new value
    const newValue = watcher.source();
    
    // Check if we should update (using deep comparison for objects)
    const { deep } = watcher.options;
    const hasChanged = deep ? !deepEqual(newValue, watcher.oldValue) : newValue !== watcher.oldValue;
    
    if (hasChanged) {
      const oldValue = watcher.oldValue;
      watcher.oldValue = newValue;
      watcher.callback(newValue, oldValue);
    }
  }
}
*/

export interface WatchOptions {
  immediate?: boolean;
  // Default deep to true
  deep?: boolean;
}

/**
 * Watches a reactive source and runs a callback when it changes
 * 
 * @param source - A function that returns the value to watch
 * @param callback - Function to call when the source changes
 * @param options - Watch options (immediate, deep)
 * @returns A function to stop watching
 */
export function watch<T = any>(
  sourceInput: WatchSourceInput<T>, // Renamed parameter
  callback: WatchCallback<T>,
  options: WatchOptions = {}
): WatchStopHandle {
  // Default deep to true unless explicitly false
  const { immediate = false, deep = true } = options;
  
  // Normalize sourceInput to always be a function
  const source: WatchSource<T> = typeof sourceInput === 'function'
    ? (sourceInput as WatchSource<T>) 
    : () => sourceInput;

  let oldValue: T | undefined;
  let initialized = false;

  // Use watchEffect to track dependencies and re-run when they change
  const stopEffect = watchEffect(() => {
    // 1. Run the source function to get the current value
    const currentValue = source();
    
    // Determine if deep watching is needed for tracking
    // Use the defaulted 'deep' value
    let needsDeepTracking = deep === true;
    // This check becomes redundant if deep defaults to true, but keep for potential explicit {deep: false} on collections?
    // Maybe simplify: if deep is true, always traverse.
    /*
    if (!needsDeepTracking && currentValue && typeof currentValue === 'object') {
        if (Array.isArray(currentValue) || currentValue instanceof Map || currentValue instanceof Set) {
            needsDeepTracking = true; // Track collections even if deep:false? Vue does shallow on collections by default.
        }
    }
    */
    
    // 2. If deep tracking needed, traverse the value *for tracking purposes only*
    if (needsDeepTracking) {
        traverse(currentValue); // Discard result, only needed for effect tracking
    }

    // 3. Compare the actual currentValue with the oldValue
    if (initialized) {
        let hasChanged = false;
        // Use the defaulted 'deep' value for comparison logic
        if (!deep) {
             hasChanged = currentValue !== oldValue;
        } else {
            // For deep watches, the effect running *implies* a relevant change occurred.
            // The traverse() call ensures dependencies were tracked. If the effect
            // runs, we assume a change happened without needing deepEqual.
            hasChanged = true; 
        }

        if (hasChanged) {
            // Get the value to pass as the previous oldValue to the callback
            const prevOldValue = oldValue; 
            // Update the stored oldValue. Clone *only if* deep watching is enabled.
            oldValue = deep ? deepClone(currentValue) : currentValue;
            callback(currentValue, prevOldValue);
        }
    } else {
        // First run: establish initial oldValue (cloned if deep) and handle immediate call
        oldValue = deep ? deepClone(currentValue) : currentValue;
        initialized = true;
        if (immediate) {
            // Pass undefined as oldValue for immediate calls
            callback(currentValue, undefined);
        }
    }
  });
  
  // Return the stop handle from watchEffect
  return stopEffect;
} 