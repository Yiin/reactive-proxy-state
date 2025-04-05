import { track, trigger } from './watchEffect';
// Removed wrapState import as ref doesn't automatically make contained objects reactive
// import { wrapState } from './wrapState';
// Symbol for marking refs
export const isRefSymbol = Symbol('isRef'); // Add export and Simplified symbol description
export function ref(value) {
    return createRef(value);
}
// Internal function to create refs (no longer shallow distinction needed here)
function createRef(rawValue) {
    // If the value is already a ref, return it directly
    if (isRef(rawValue)) {
        // Cast rawValue back to Ref<T> after type guard
        return rawValue;
    }
    // The ref holds the raw value directly
    let value = rawValue;
    // Create the ref object with getter/setter for reactivity
    const r = {
        [isRefSymbol]: true, // Mark as ref
        get value() {
            // Track dependency on the 'value' property of this ref object
            // Ensure 'r' is treated as the target object for tracking
            track(r, 'value');
            return value;
        },
        set value(newValue) {
            // Check if value actually changed (using simple comparison)
            // For objects, this means identity change, not deep mutation.
            if (value !== newValue) {
                value = newValue;
                // Trigger effects depending on the 'value' property of this ref object
                // Ensure 'r' is treated as the target object for triggering
                trigger(r, 'value');
            }
        },
    }; // Explicit cast to ensure type correctness
    return r;
}
/**
 * Checks if a value is a ref object.
 */
export function isRef(r) {
    return !!(r && r[isRefSymbol]);
}
/**
 * Returns the inner value if the argument is a ref, otherwise returns the
 * argument itself.
 */
export function unref(refValue) {
    return isRef(refValue) ? refValue.value : refValue;
}
// Basic triggerRef function (may need refinement if used)
/*
export function triggerRef(ref: Ref<any>): void {
  trigger(ref, 'value');
}
*/
// TODO: Implement shallowRef if needed (uses createRef(value, true))
// TODO: Implement customRef if needed (more advanced) 
