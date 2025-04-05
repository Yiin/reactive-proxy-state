import { watchEffect, track, trigger } from './watchEffect';
import { isRefSymbol } from './ref';
// symbol for identifying computed refs
const isComputedSymbol = Symbol('isComputed');
// implementation using a lazy watchEffect with a custom scheduler for caching
export function computed(getterOrOptions) {
    let getter;
    let setter;
    const isGetter = typeof getterOrOptions === 'function';
    if (isGetter) {
        getter = getterOrOptions;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    let _value;
    let _dirty = true; // flag to track if the cached value is stale
    let computedRef; // placeholder to allow self-reference in scheduler
    // create a lazy effect; scheduler intercepts triggers to mark dirty instead of recomputing immediately
    const stopHandle = watchEffect(getter, {
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
        get value() {
            track(computedRef, 'value');
            // if dirty, recompute value by running the getter
            if (_dirty) {
                _value = effectRunner.run();
                _dirty = false; // mark as clean after successful run
            }
            return _value;
        },
        set value(newValue) {
            if (setter) {
                setter(newValue);
            }
            else {
                console.warn('computed value is read-only');
            }
        },
        // stop: stopHandle // potentially expose stop handle
    };
    return computedRef;
}
export function isComputed(c) {
    return !!(c && c[isComputedSymbol]);
}
