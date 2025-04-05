import { track, trigger } from './watchEffect';
// Removed reactive import as ref doesn't automatically make contained objects reactive
// import { reactive } from './reactive';

// Symbol for marking refs
export const isRefSymbol = Symbol('isRef'); // Add export and Simplified symbol description

// Helper to check if a value is an object (and not null) - Keep for potential future use?
/*
function isObject(val: any): val is object {
  return val !== null && typeof val === 'object';
}
*/

// Ref interface
export interface Ref<T = any> {
  value: T;
  // Type marker
  readonly [isRefSymbol]: true;
}

/**
 * Takes an inner value and returns a reactive and mutable ref object,
 * which has a single property `.value` that points to the inner value.
 * The ref tracks access and mutations to its `.value` property.
 * If the initial value is an object, it is NOT automatically made reactive.
 */
export function ref<T>(value: T): Ref<T>;
export function ref<T = undefined>(): Ref<T | undefined>; // Overload for no argument
export function ref<T>(value?: T): Ref<T | undefined> {
  return createRef(value);
}

// Internal function to create refs (no longer shallow distinction needed here)
function createRef<T>(rawValue: T): Ref<T> {
  // If the value is already a ref, return it directly
  if (isRef(rawValue)) {
    // Cast rawValue back to Ref<T> after type guard
    return rawValue as Ref<T>; 
  }

  // The ref holds the raw value directly
  let value = rawValue;

  // Create the ref object with getter/setter for reactivity
  const r = {
    [isRefSymbol]: true, // Mark as ref
    get value(): T {
      // Track dependency on the 'value' property of this ref object
      // Ensure 'r' is treated as the target object for tracking
      track(r, 'value');
      return value;
    },
    set value(newValue: T) {
      // Check if value actually changed (using simple comparison)
      // For objects, this means identity change, not deep mutation.
      if (value !== newValue) {
        value = newValue;
        // Trigger effects depending on the 'value' property of this ref object
        // Ensure 'r' is treated as the target object for triggering
        trigger(r, 'value');
      }
    },
  } as Ref<T>; // Explicit cast to ensure type correctness

  return r;
}

/**
 * Checks if a value is a ref object.
 */
export function isRef<T>(r: any): r is Ref<T> {
  return !!(r && r[isRefSymbol]);
}

/**
 * Returns the inner value if the argument is a ref, otherwise returns the
 * argument itself.
 */
export function unref<T>(refValue: T | Ref<T>): T {
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