import { StateEvent, Path, EmitFunction } from './types';
import { deepEqual } from './utils';
import { watchEffect } from './watch-effect';
import { traverse, deepClone } from './utils';

// type for the callback function executed on change
type WatchCallback<T = any> = (newValue: T, oldValue: T | undefined) => void;
// type for a function that returns the value to watch
type WatchSource<T = any> = () => T;
// input type allows passing a getter function or a reactive object/ref directly
type WatchSourceInput<T = any> = WatchSource<T> | T;
// function returned by watch() to stop the watcher
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

// options for configuring watch behavior
export interface WatchOptions {
  immediate?: boolean; // if true, run the callback immediately with the initial value
  deep?: boolean;      // if true, traverse the source deeply for dependencies (defaults to true)
}

/**
 * watches a reactive source (getter function or reactive object/ref)
 * and runs a callback when the source's value changes.
 */
export function watch<T = any>(
  sourceInput: WatchSourceInput<T>,
  callback: WatchCallback<T>,
  options: WatchOptions = {}
): WatchStopHandle {
  const { immediate = false, deep = true } = options;

  // normalize source to always be a getter function
  const source: WatchSource<T> = typeof sourceInput === 'function'
    ? (sourceInput as WatchSource<T>)
    : () => sourceInput;

  let oldValue: T | undefined;
  let initialized = false;

  // use watchEffect internally to handle dependency tracking
  const stopEffect = watchEffect(() => {
    const currentValue = source();

    // if deep watching, traverse the current value to track nested dependencies
    if (deep) {
        traverse(currentValue);
    }

    if (initialized) {
        let hasChanged = false;
        // for deep watches, the effect running implies a dependency changed.
        // for shallow, explicitly check reference equality.
        hasChanged = deep || currentValue !== oldValue;

        if (hasChanged) {
            const prevOldValue = oldValue;
            // store a clone for deep watches to pass as the correct oldValue next time
            oldValue = deep ? deepClone(currentValue) : currentValue;
            callback(currentValue, prevOldValue);
        }
    } else {
        // first run: store initial value (cloned if deep) and run immediate callback if requested
        oldValue = deep ? deepClone(currentValue) : currentValue;
        initialized = true;
        if (immediate) {
            callback(currentValue, undefined); // pass undefined as oldValue for immediate
        }
    }
  }, { lazy: false }); // run immediately (watchEffect handles `immediate` option internally)

  return stopEffect;
} 