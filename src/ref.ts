import { track, trigger } from './watch-effect';

// symbol used to identify refs internally and via isRef()
export const isRefSymbol = Symbol('isRef');

// ref interface defining the shape of a ref object
export interface Ref<T = any> {
  value: T;
  // internal marker
  readonly [isRefSymbol]: true;
}

/**
 * Creates a reactive reference object.
 * The object has a single `.value` property.
 * Reactivity is tracked on access and mutation of the `.value` property.
 * If an object is passed as the initial value, the object itself is *not* made deeply reactive.
 * Only the assignment to `.value` is tracked.
 * 
 * @param value - The value to wrap in a ref
 * @returns A ref object with the value
 */
export function ref<T>(value: T): Ref<T>;
export function ref<T = undefined>(): Ref<T | undefined>; // overload for creating an empty ref (value will be undefined)
export function ref<T>(value?: T): Ref<T | undefined> {
  return createRef(value);
}

// internal factory for creating ref objects
function createRef<T>(rawValue: T): Ref<T> {
  // avoid wrapping if the value is already a ref
  if (isRef(rawValue)) {
    return rawValue as Ref<T>;
  }

  // store the inner value
  let _value = rawValue;

  // create the ref object with a getter/setter on `.value`
  const r = {
    [isRefSymbol]: true, // mark as a ref using the symbol
    get value(): T {
      // track dependency when `.value` is accessed
      // `r` (the ref object itself) is the target for tracking
      track(r, 'value');
      return _value;
    },
    set value(newValue: T) {
      // only update and trigger if the value has actually changed
      // this uses strict equality (===), so for objects, it checks reference equality
      if (_value !== newValue) {
        _value = newValue;
        // trigger effects when `.value` is assigned a new value
        // `r` (the ref object itself) is the target for triggering
        trigger(r, 'value');
      }
    },
  } as Ref<T>; // cast to ensure the object conforms to the Ref interface

  return r;
}

/**
 * Checks if a value is a ref object.
 * 
 * @param r - The value to check
 * @returns true if the value is a ref, false otherwise
 */
export function isRef<T>(r: any): r is Ref<T> {
  // check for the presence of the internal symbol
  return !!(r && r[isRefSymbol]);
}

/**
 * Returns the inner value if the argument is a ref,
 * otherwise returns the argument itself. this is a sugar for `isRef(val) ? val.value : val`.
 * 
 * @param refValue - The value to unref
 * @returns The inner value if the argument is a ref, otherwise the argument itself
 */
export function unref<T>(refValue: T | Ref<T>): T {
  return isRef(refValue) ? refValue.value : refValue;
}

/**
 * Converts an object's properties to reactive refs.
 * This is useful when you want to destructure reactive objects but maintain reactivity.
 * 
 * @param object The reactive object to convert to refs
 * @returns An object with the same properties, where each property is a ref connected to the original object
 */
export function toRefs<T extends object>(object: T): { [K in keyof T]: Ref<T[K]> } {
  const result: any = {};

  for (const key in object) {
    result[key] = toRef(object, key);
  }

  return result;
}

/**
 * Creates a ref that is connected to a property on an object.
 * 
 * @param object The source object
 * @param key The property key
 * @returns A ref connected to the object's property
 */
export function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]> {
  return {
    [isRefSymbol]: true,
    get value() {
      track(this, 'value');
      return object[key];
    },
    set value(newVal) {
      object[key] = newVal;
    }
  } as Ref<T[K]>;
}

/**
 * Basic triggerRef function
 * 
 * @param ref - The ref object to trigger
 */
export function triggerRef(ref: Ref<any>): void {
  trigger(ref, 'value');
}
