import { deepEqual } from './utils';
import { watchEffect } from './watch-effect';
import { traverse, deepClone } from './utils';
import { isRef } from './ref';
import { isComputed } from './computed';
import { WatchSource, UnwrapWatchSource, UnwrapWatchSources } from './types';

type WatchCallback<T, O> = (newValue: T, oldValue: O) => void;
type WatchStopHandle = () => void;

export interface WatchOptions {
  immediate?: boolean; // if true, run the callback immediately with the initial value
  deep?: boolean;      // if true, traverse the source deeply for dependencies (defaults to true for objects)
}

// Overload for multiple sources
export function watch<
  T extends readonly WatchSource<unknown>[],
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  callback: WatchCallback<
    UnwrapWatchSources<T>,
    Immediate extends true ? (UnwrapWatchSources<T> | undefined) : UnwrapWatchSources<T>
  >,
  options?: WatchOptions
): WatchStopHandle;

// Overload for a single getter
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: () => T,
  callback: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions
): WatchStopHandle;

// Overload for a single WatchSource (Ref, ComputedRef, or reactive object)
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  callback: WatchCallback<
    UnwrapWatchSource<T>,
    Immediate extends true ? (UnwrapWatchSource<T> | undefined) : UnwrapWatchSource<T>
  >,
  options?: WatchOptions
): WatchStopHandle;

/**
 * Watches a reactive source and runs a callback when it changes.
 *
 * @param source - A single source or array of sources to watch
 * @param callback - Callback function that receives new/old values
 * @param options - Watch options
 */
export function watch<T>(
  source: WatchSource<T> | readonly WatchSource<any>[],
  callback: WatchCallback<any, any>,
  options: WatchOptions = {}
): WatchStopHandle {
  const { immediate = false, deep = true } = options;

  const isMultiSource = Array.isArray(source);
  
  const getter = (): any => {
    if (isMultiSource) {
      return (source as any[]).map(s => {
        if (isRef(s)) return s.value;
        if (isComputed(s)) return s.value;
        if (typeof s === 'function') return (s as Function)();
        return s;
      });
    }
    if (isRef(source)) return source.value;
    if (isComputed(source)) return source.value;
    if (typeof source === 'function') return (source as Function)();
    return source;
  };

  let oldValue: any;
  let initialized = false;

  const stopEffect = watchEffect(() => {
    let currentValue = getter();

    if (deep) {
        traverse(currentValue);
    }

    const job = () => {
      if (initialized) {
          let hasChanged = false;
          
          if (isMultiSource) {
            if (!Array.isArray(oldValue) || currentValue.length !== oldValue.length) {
              hasChanged = true;
            } else {
              hasChanged = currentValue.some((val: any, i: number) => {
                return deep ? !deepEqual(val, oldValue[i]) : val !== oldValue[i];
              });
            }
          } else {
            hasChanged = deep ? !deepEqual(currentValue, oldValue) : currentValue !== oldValue;
          }

          if (hasChanged) {
              const prevOldValue = oldValue;
              
              if (isMultiSource) {
                currentValue = getter();
              }
              
              const valueToClone = (currentValue && typeof currentValue === 'object' && (currentValue as any).__v_raw) 
                ? (currentValue as any).__v_raw 
                : currentValue;
              oldValue = deep ? deepClone(valueToClone) : currentValue;
              
              callback(currentValue, prevOldValue);
          }
      } else {
          const valueToClone = (currentValue && typeof currentValue === 'object' && (currentValue as any).__v_raw) 
            ? (currentValue as any).__v_raw 
            : currentValue;
          oldValue = deep ? deepClone(valueToClone) : currentValue;
          initialized = true;
          if (immediate) {
              callback(currentValue, undefined);
          }
      }
    }
    
    job();
  }); 

  return stopEffect;
}
