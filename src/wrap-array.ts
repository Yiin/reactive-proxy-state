import { EmitFunction, Path, StateEvent } from "./types";
import {
  deepClone,
  deepEqual,
  unwrapForStore,
  getPathConcat,
  setPathConcat,
  wrapperCache,
  globalSeen,
  proxyStats,
  evictDeep,
} from "./utils";
import { reactive } from "./reactive";
import { wrapMap } from "./wrap-map";
import { wrapSet } from "./wrap-set";
import { track, trigger } from "./watch-effect";
import { ReactiveFlags } from "./constants";

// avoid repeated typeof checks
function isObject(v: any): v is object {
  return v && typeof v === "object";
}

export function wrapArray<T extends any[]>(
  arr: T,
  emit?: EmitFunction,
  path: Path = []
): T {
  // reuse existing proxy if available for performance
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy) return cachedProxy as T;
  if (globalSeen.has(arr)) return globalSeen.get(arr);

  // cache for wrapped methods to avoid re-creating them on each call
  const methodCache: { [key: string | symbol]: Function } = {};

  const proxy = new Proxy(arr, {
    get(target: T, prop: string | symbol, receiver: any): any {
      if (prop === ReactiveFlags.RAW) return target;
      if (prop === ReactiveFlags.IS_REACTIVE) return true;

      track(target, prop);

      if (methodCache[prop]) {
        return methodCache[prop];
      }

      // handle specific array mutation methods that require custom logic and event emission
      switch (prop) {
        case "push":
          track(target, "length");
          methodCache[prop] = function (...items: any[]): number {
            const oldLength = target.length;
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              const event: StateEvent = {
                action: "array-push",
                path: path,
                key: oldLength, // start index was the old length
                items: items,
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case "pop":
          track(target, "length");
          methodCache[prop] = function (): any {
            if (target.length === 0) return undefined;
            const oldLength = target.length;
            const poppedIndex = oldLength - 1;
            const oldValue = target[poppedIndex];
            const result = target.pop();
            const newLength = target.length;
            const event: StateEvent = {
              action: "array-pop",
              path: path,
              key: poppedIndex,
              oldValue: oldValue,
            };
            emit?.(event);
            if (isObject(oldValue)) evictDeep(oldValue);
            trigger(target, Symbol.iterator);
            if (oldLength !== newLength) {
              trigger(target, "length");
            }
            return result;
          };
          return methodCache[prop];
        case "shift":
          track(target, "length");
          methodCache[prop] = function (): any {
            if (target.length === 0) return undefined;
            const oldLength = target.length;
            const oldValue = target[0];
            const result = target.shift();
            const newLength = target.length;
            const event: StateEvent = {
              action: "array-shift",
              path: path,
              key: 0,
              oldValue: oldValue,
            };
            emit?.(event);
            if (isObject(oldValue)) evictDeep(oldValue);
            trigger(target, Symbol.iterator);
            if (oldLength !== newLength) {
              trigger(target, "length");
            }
            return result;
          };
          return methodCache[prop];
        case "unshift":
          track(target, "length");
          methodCache[prop] = function (...items: any[]): number {
            const oldLength = target.length;
            const result = target.unshift(...items);
            const newLength = target.length;
            if (items.length > 0) {
              const event: StateEvent = {
                action: "array-unshift",
                path: path,
                key: 0,
                items: items,
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case "splice":
          track(target, "length");
          methodCache[prop] = function (
            start: number,
            deleteCount?: number,
            ...items: any[]
          ): any[] {
            const oldLength = target.length;
            const actualStart =
              start < 0
                ? Math.max(target.length + start, 0)
                : Math.min(start, target.length);
            const deleteCountNum =
              deleteCount === undefined
                ? target.length - actualStart
                : Number(deleteCount);
            const actualDeleteCount = Math.min(
              deleteCountNum,
              target.length - actualStart
            );
            const deletedItems = target.slice(
              actualStart,
              actualStart + actualDeleteCount
            );

            const result = target.splice(start, deleteCountNum, ...items);
            const newLength = target.length;

            if (actualDeleteCount > 0 || items.length > 0) {
              const event: StateEvent = {
                action: "array-splice",
                path: path,
                key: actualStart,
                deleteCount: actualDeleteCount,
                items: items.length > 0 ? items : undefined,
                oldValues: deletedItems.length > 0 ? deletedItems : undefined,
              };
              emit?.(event);
              for (let i = 0; i < deletedItems.length; i++) {
                if (isObject(deletedItems[i])) evictDeep(deletedItems[i]);
              }
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        // special wrapper for find to ensure returned element is reactive
        case "find": {
          track(target, Symbol.iterator);
          if (!methodCache[prop]) {
            methodCache[prop] = function (
              predicate: (value: any, index: number, obj: any[]) => boolean,
              thisArg?: any
            ) {
              const idx = Array.prototype.findIndex.call(target, predicate, thisArg);
              if (idx === -1) return undefined;
              const value = target[idx];
              if (!isObject(value)) return value;

              // construct path for the found index and wrap like numeric index access
              const propKey = String(idx);
              const pathKey =
                path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
              let newPath = getPathConcat(pathKey);
              if (newPath === undefined) {
                newPath = path.concat(propKey);
                setPathConcat(pathKey, newPath);
              }

              if (globalSeen.has(value)) return globalSeen.get(value);
              const cachedValueProxy = wrapperCache.get(value);
              if (cachedValueProxy) return cachedValueProxy;

              if (Array.isArray(value)) return wrapArray(value, emit, newPath);
              if (value instanceof Map) return wrapMap(value, emit, newPath);
              if (value instanceof Set) return wrapSet(value, emit, newPath);
              if (value instanceof Date) return new Date(value.getTime());
              return reactive(value, emit, newPath);
            };
          }
          return methodCache[prop];
        }
        // special wrapper for at to ensure returned element is reactive
        case "at": {
          track(target, Symbol.iterator);
          if (!methodCache[prop]) {
            methodCache[prop] = function (index: number): any {
              // emulate Array.prototype.at to support negative indexes
              let idx = Number(index);
              if (!Number.isInteger(idx)) idx = Math.trunc(idx);
              if (idx < 0) idx = target.length + idx;
              if (idx < 0 || idx >= target.length) return undefined;

              const value = target[idx];
              if (!isObject(value)) return value;

              const propKey = String(idx);
              const pathKey =
                path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
              let newPath = getPathConcat(pathKey);
              if (newPath === undefined) {
                newPath = path.concat(propKey);
                setPathConcat(pathKey, newPath);
              }

              if (globalSeen.has(value)) return globalSeen.get(value);
              const cachedValueProxy = wrapperCache.get(value);
              if (cachedValueProxy) return cachedValueProxy;

              if (Array.isArray(value)) return wrapArray(value, emit, newPath);
              if (value instanceof Map) return wrapMap(value, emit, newPath);
              if (value instanceof Set) return wrapSet(value, emit, newPath);
              if (value instanceof Date) return new Date(value.getTime());
              return reactive(value, emit, newPath);
            };
          }
          return methodCache[prop];
        }
        // handle methods that rely on iteration state
        case Symbol.iterator:
        case "values":
        case "keys":
        case "entries":
        case "forEach":
        case "map":
        case "filter":
        case "reduce":
        case "reduceRight":
        case "findIndex":
        case "every":
        case "some":
        case "join":
          track(target, Symbol.iterator);
          // fall through to default behavior (usually binding)
          break;
        case "length":
          track(target, "length");
          return Reflect.get(target, prop, receiver);
      }

      const value = Reflect.get(target, prop, receiver);

      // determine if the property access is numeric array index access
      const isNumericIndex =
        typeof prop === "number" ||
        (typeof prop === "string" && !isNaN(parseInt(prop, 10)));

      if (isNumericIndex) {
        track(target, String(prop));
        if (!isObject(value)) return value;
        if (globalSeen.has(value)) return globalSeen.get(value);

        // reuse existing proxy for nested object/array if available
        const cachedValueProxy = wrapperCache.get(value);
        if (cachedValueProxy) return cachedValueProxy;

        // calculate the nested path for the element, optimizing with caching
        const propKey = String(prop);
        const pathKey =
          path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);

        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }

        // recursively wrap nested structures
        if (Array.isArray(value)) return wrapArray(value, emit, newPath);
        if (value instanceof Map) return wrapMap(value, emit, newPath);
        if (value instanceof Set) return wrapSet(value, emit, newPath);
        if (value instanceof Date) return new Date(value.getTime()); // dates are not proxied, return a copy
        return reactive(value, emit, newPath);
      }

      // ensure functions accessed directly are bound to the original target
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
    set(target: T, prop: string | symbol, value: any, receiver: any): boolean {
      if (isObject(value)) value = unwrapForStore(value);

      const oldValue = (target as any)[prop];

      // avoid unnecessary triggers if value hasn't changed
      if (oldValue === value) return true;
      if (
        isObject(oldValue) &&
        isObject(value) &&
        deepEqual(oldValue, value, new WeakMap())
      )
        return true;

      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const result = Reflect.set(target, prop, value, receiver);

      const isNumericIndex =
        typeof prop === "number" ||
        (typeof prop === "string" && !isNaN(parseInt(String(prop))));

      // emit event and trigger effects only if the set was successful and wasn't intercepted by a setter
      // (unless it's a direct numeric index set, which doesn't have a descriptor.set)
      if (result && (!descriptor || !descriptor.set || isNumericIndex)) {
        const propKey = String(prop);
        const pathKey =
          path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);

        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }

        const event: StateEvent = {
          action: "set",
          path: newPath,
          oldValue,
          newValue: isObject(value) ? deepClone(value) : value,
        };
        emit?.(event);
        if (isObject(oldValue) && oldValue !== value) {
          evictDeep(oldValue);
        }
        trigger(target, prop);
      }
      return result;
    },
  });

  globalSeen.set(arr, proxy);
  wrapperCache.set(arr, proxy);
  proxyStats.created++;
  proxyStats.arrays++;
  return proxy;
}
