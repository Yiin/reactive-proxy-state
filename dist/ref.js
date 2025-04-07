import { track, trigger } from './watch-effect';
// Removed reactive import as ref doesn't automatically make contained objects reactive
// import { reactive } from './reactive';
// symbol used to identify refs internally and via isRef()
export const isRefSymbol = Symbol('isRef');
export function ref(value) {
    return createRef(value);
}
// internal factory for creating ref objects
function createRef(rawValue) {
    // avoid wrapping if the value is already a ref
    if (isRef(rawValue)) {
        return rawValue;
    }
    // store the inner value
    let _value = rawValue;
    // create the ref object with a getter/setter on `.value`
    const r = {
        [isRefSymbol]: true, // mark as a ref using the symbol
        get value() {
            // track dependency when `.value` is accessed
            // `r` (the ref object itself) is the target for tracking
            track(r, 'value');
            return _value;
        },
        set value(newValue) {
            // only update and trigger if the value has actually changed
            // this uses strict equality (===), so for objects, it checks reference equality
            if (_value !== newValue) {
                _value = newValue;
                // trigger effects when `.value` is assigned a new value
                // `r` (the ref object itself) is the target for triggering
                trigger(r, 'value');
            }
        },
    }; // cast to ensure the object conforms to the Ref interface
    return r;
}
/**
 * checks if a value is a ref object.
 */
export function isRef(r) {
    // check for the presence of the internal symbol
    return !!(r && r[isRefSymbol]);
}
/**
 * returns the inner value if the argument is a ref,
 * otherwise returns the argument itself. this is a sugar for `isRef(val) ? val.value : val`.
 */
export function unref(refValue) {
    return isRef(refValue) ? refValue.value : refValue;
}
/**
 * Converts an object's properties to reactive refs.
 * This is useful when you want to destructure reactive objects but maintain reactivity.
 * @param object The reactive object to convert to refs
 * @returns An object with the same properties, where each property is a ref connected to the original object
 */
export function toRefs(object) {
    const result = {};
    for (const key in object) {
        result[key] = toRef(object, key);
    }
    return result;
}
/**
 * Creates a ref that is connected to a property on an object.
 * @param object The source object
 * @param key The property key
 * @returns A ref connected to the object's property
 */
export function toRef(object, key) {
    return {
        [isRefSymbol]: true,
        get value() {
            track(this, 'value');
            return object[key];
        },
        set value(newVal) {
            object[key] = newVal;
        }
    };
}
// Basic triggerRef function (may need refinement if used)
/*
export function triggerRef(ref: Ref<any>): void {
  trigger(ref, 'value');
}
*/
// TODO: Implement shallowRef if needed (uses createRef(value, true))
// TODO: Implement customRef if needed (more advanced) 
