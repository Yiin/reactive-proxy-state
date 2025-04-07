import { watchEffect } from './watch-effect';
import { traverse, deepClone } from './utils';
/**
 * watches a reactive source (getter function or reactive object/ref)
 * and runs a callback when the source's value changes.
 */
export function watch(sourceInput, callback, options = {}) {
    const { immediate = false, deep = true } = options;
    // normalize source to always be a getter function
    const source = typeof sourceInput === 'function'
        ? sourceInput
        : () => sourceInput;
    let oldValue;
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
        }
        else {
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
