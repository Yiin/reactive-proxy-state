import { watchEffect, track, trigger, TrackedEffect, activeEffect, cleanupEffect, setActiveEffect, WatchEffectStopHandle } from './watchEffect';
import { Ref, isRef, isRefSymbol, unref } from './ref';

// Symbol for marking computed refs
const isComputedSymbol = Symbol('isComputed');

// Interface for computed refs (read-only value)
export interface ComputedRef<T = any> extends Omit<Ref<T>, 'value'> {
  readonly value: T;
  readonly [isComputedSymbol]: true;
  readonly [isRefSymbol]: true; // Add isRefSymbol to conform to Ref-like structure
  // Expose the internal effect for potential advanced usage or debugging
  // readonly effect: TrackedEffect;
}

// Interface for writable computed refs (if setter is provided)
// Note: We are implementing the read-only version first.
export interface WritableComputedRef<T> extends Ref<T> {
  // readonly effect: ReactiveEffect<T> // Internal effect instance might be exposed
}

// Type for the getter function
type ComputedGetter<T> = () => T;

// Type for setter function (for writable computed)
// type ComputedSetter<T> = (v: T) => void;

// Overload for getter-only computed
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;

// Implementation v4 - Using watchEffect with scheduler
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T> {
  let _value: T;
  let _dirty = true; // Start dirty
  let computedRef: ComputedRef<T>; // Placeholder

  // Create a lazy effect with a scheduler
  const stopHandle: WatchEffectStopHandle = watchEffect(getter, {
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

    get value(): T {
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
    set value(newValue: T) {
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
export function isComputed<T>(c: any): c is ComputedRef<T> /* | WritableComputedRef<T> */ {
  return !!(c && c[isComputedSymbol]);
} 