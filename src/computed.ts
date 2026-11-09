import { watchEffect, track, trigger, WatchEffectStopHandle } from './watch-effect';
import { Ref, isRef, isRefSymbol, unref } from './ref';

// symbol for identifying computed refs
const isComputedSymbol = Symbol('isComputed');

// resembles a ref but is read-only and derived from a getter
export interface ComputedRef<T = any> extends Omit<Ref<T>, 'value'> {
  readonly value: T;
  readonly [isComputedSymbol]: true;
  readonly [isRefSymbol]: true; // mark as ref-like for type checks
  readonly stop: WatchEffectStopHandle<T>; // expose the stop handle for manual cleanup
}

// interface for writable computed refs
export interface WritableComputedRef<T> extends Ref<T> {
    readonly [isComputedSymbol]: true;
    readonly [isRefSymbol]: true;
    readonly stop: WatchEffectStopHandle<T>; // expose the stop handle for manual cleanup
}

type ComputedGetter<T> = () => T;
type ComputedSetter<T> = (v: T) => void;

interface WritableComputedOptions<T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<T>;
}

/**
 * Creates a computed ref from a getter function
 * 
 * @param getter - The getter function
 * @returns A computed ref
 */
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;
export function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>;

// implementation using a lazy watchEffect with a custom scheduler for caching
export function computed<T>(getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>): ComputedRef<T> | WritableComputedRef<T> {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T> | undefined;

  const isGetter = typeof getterOrOptions === 'function';
  if (isGetter) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  let _value: T;
  let _dirty = true; // flag to track if the cached value is stale
  let computedRef: ComputedRef<T> | WritableComputedRef<T>; // placeholder to allow self-reference in scheduler

  // a lazy effect: a write to what the getter read marks the value stale
  // instead of recomputing it, and triggers the readers of the value in the
  // same batch, so every computed the write made stale is stale before any
  // effect runs and reads it
  const stopHandle: WatchEffectStopHandle = watchEffect(getter, { lazy: true });

  const effectRunner = stopHandle.effect;
  effectRunner.invalidate = () => {
    if (!_dirty) {
      _dirty = true;
      // trigger effects that depend on this computed ref
      trigger(computedRef, 'value');
    }
  };

  computedRef = {
    [isRefSymbol]: true,
    [isComputedSymbol]: true,

    get value(): T {
      track(computedRef, 'value');
      // if dirty, recompute value by running the getter
      if (_dirty) {
        // clean before the getter runs: a write the getter sets off to what
        // it already read (through effects of its own) marks it stale again
        _dirty = false;
        try {
          _value = effectRunner.run();
        } catch (error) {
          _dirty = true;
          throw error;
        }
      }
      return _value;
    },
    set value(newValue: T) {
       if (setter) {
           setter(newValue);
       } else {
           console.warn('computed value is read-only');
       }
    },
    stop: stopHandle // expose the stop handle for manual cleanup
  };

  return computedRef;
}

export function isComputed<T>(c: any): c is ComputedRef<T> | WritableComputedRef<T> {
  return !!(c && c[isComputedSymbol]);
}
