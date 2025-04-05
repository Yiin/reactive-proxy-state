import { watchEffect, track, trigger, TrackedEffect, activeEffect, cleanupEffect, setActiveEffect, WatchEffectStopHandle } from './watchEffect';
import { Ref, isRef, isRefSymbol, unref } from './ref';

// symbol for identifying computed refs
const isComputedSymbol = Symbol('isComputed');

// resembles a ref but is read-only and derived from a getter
export interface ComputedRef<T = any> extends Omit<Ref<T>, 'value'> {
  readonly value: T;
  readonly [isComputedSymbol]: true;
  readonly [isRefSymbol]: true; // mark as ref-like for type checks
}

// interface for writable computed refs (not implemented yet)
// export interface WritableComputedRef<T> extends Ref<T> { ... }

type ComputedGetter<T> = () => T;
// type ComputedSetter<T> = (v: T) => void;

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;

// implementation using a lazy watchEffect with a custom scheduler for caching
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T> {
  let _value: T;
  let _dirty = true; // flag to track if the cached value is stale
  let computedRef: ComputedRef<T>; // placeholder to allow self-reference in scheduler

  // create a lazy effect; scheduler intercepts triggers to mark dirty instead of recomputing immediately
  const stopHandle: WatchEffectStopHandle = watchEffect(getter, {
    lazy: true,
    scheduler: () => {
      if (!_dirty) {
        _dirty = true;
        // trigger effects that depend on this computed ref
        trigger(computedRef, 'value');
      }
    },
  });

  const effectRunner = stopHandle.effect;

  computedRef = {
    [isRefSymbol]: true,
    [isComputedSymbol]: true,

    get value(): T {
      track(computedRef, 'value');
      // if dirty, recompute value by running the getter
      if (_dirty) {
        _value = effectRunner.run();
        _dirty = false; // mark as clean after successful run
      }
      return _value;
    },
    set value(newValue: T) {
       console.warn('computed value is read-only');
    },
    // stop: stopHandle // potentially expose stop handle
  };

  return computedRef;
}

export function isComputed<T>(c: any): c is ComputedRef<T> {
  return !!(c && c[isComputedSymbol]);
} 