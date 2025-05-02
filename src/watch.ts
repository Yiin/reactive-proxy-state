import { StateEvent, Path, EmitFunction } from './types';
import { deepEqual } from './utils';
import { watchEffect } from './watch-effect';
import { traverse, deepClone } from './utils';

type WatchCallback<T = any> = (newValue: T, oldValue: T | undefined) => void;
type WatchSource<T = any> = () => T;
type WatchSourceInput<T = any> = WatchSource<T> | T;
type WatchStopHandle = () => void;

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
