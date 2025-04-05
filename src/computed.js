import { watchEffect, track, trigger } from './watchEffect';
import { isRefSymbol } from './ref';
// Symbol for marking computed refs
const isComputedSymbol = Symbol('isComputed');
// Implementation v4 - Using watchEffect with scheduler
export function computed(getter) {
    let _value;
    let _dirty = true; // Start dirty
    let computedRef; // Placeholder
    // Create a lazy effect with a scheduler
    const stopHandle = watchEffect(getter, {
        lazy: true, // Don't run the getter immediately
        scheduler: () => {
            // When a dependency changes, don't re-run the getter immediately.
            // Instead, mark the computed as dirty and trigger downstream effects.
            if (!_dirty) {
                _dirty = true;
                // Trigger effects that depend on the computed ref's value
                trigger(computedRef, 'value');
            }
        },
    });
    // Access the internal effect runner
    const effectRunner = stopHandle.effect;
    computedRef = {
        [isRefSymbol]: true,
        [isComputedSymbol]: true,
        get value() {
            // 1. Track access to this computed value for any outer effects
            track(computedRef, 'value');
            // 2. If dirty, run the effect manually. This will:
            //    - Execute the getter
            //    - Update _value (via getter's return)
            //    - Track dependencies for the getter (handled by watchEffect internals)
            //    - Set _dirty to false
            if (_dirty) {
                // console.log('Recomputing computed value via getter access');
                _value = effectRunner.run(); // Run the getter, update value, track deps
                _dirty = false; // Mark as clean *after* successful run
            }
            // 3. Return the (now current) value.
            return _value;
        },
        set value(newValue) {
            console.warn('Computed value is read-only');
        },
        // Expose the stop function if needed
        // stop: stopHandle
    };
    // Initial computation is lazy, happens on first .value access.
    // The scheduler ensures dependency changes only mark it dirty.
    return computedRef;
}
/**
 * Checks if a value is a computed ref.
 */
export function isComputed(c) {
    return !!(c && c[isComputedSymbol]);
}
