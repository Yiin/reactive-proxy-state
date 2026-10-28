import { StateEvent } from "./types";
import {
  deepEqual,
  unwrapForStore,
  wrapperCache,
  globalSeen,
  proxyStats,
} from "./utils";
import { wrapChild } from "./reactive";
import {
  LocationNode,
  attachValue,
  copyPayload,
  detachPlace,
  dispatch,
  evictDeep,
  locate,
  relinkArray,
  relinkReorder,
  copyPayloadAfter,
} from "./location";
import { track, trigger } from "./watch-effect";
import { ReactiveFlags } from "./constants";

// avoid repeated typeof checks
function isObject(v: any): v is object {
  return v && typeof v === "object";
}

/** A canonical array index ("0", "17") as a number, or -1. */
function arrayIndex(prop: string | symbol): number {
  if (typeof prop !== "string" || prop.length === 0 || prop.length > 10) return -1;
  const first = prop.charCodeAt(0);
  if (first < 48 || first > 57 || (first === 48 && prop.length > 1)) return -1;
  for (let i = 1; i < prop.length; i++) {
    const code = prop.charCodeAt(i);
    if (code < 48 || code > 57) return -1;
  }
  const index = Number(prop);
  return index < 4294967295 ? index : -1;
}

/** Place key for an array property: the index as a number, else the name. */
function placeKey(prop: string | symbol): unknown {
  const index = arrayIndex(prop);
  return index >= 0 ? index : prop;
}

/**
 * ToIntegerOrInfinity: NaN is 0, fractions go toward zero, -0 is 0. Unary
 * plus is ToNumber, so a BigInt or a Symbol throws a TypeError like native
 * `splice` (`Number(1n)` would give 1).
 */
function toIntegerOrInfinity(value: unknown): number {
  const number = +(value as number);
  if (number !== number || number === 0) return 0;
  return Math.trunc(number);
}

/** An index relative to `length` (negative counts from the end), clamped to 0..length. */
function clampIndex(relative: number, length: number): number {
  return relative < 0 ? Math.max(length + relative, 0) : Math.min(relative, length);
}

/** Store raw objects, never proxies, in the raw array. */
function unwrapItems(items: any[]): void {
  for (let i = 0; i < items.length; i++) {
    if (isObject(items[i])) items[i] = unwrapForStore(items[i]);
  }
}

/**
 * Write `sorted` (a copy of `target` that `sort` sorted) into `target` the
 * way native `sort` writes its result: every index in order, the holes at
 * the end deleted, and a TypeError for a write or delete that fails.
 */
function writeSorted(target: unknown[], sorted: readonly unknown[]): void {
  for (let i = 0; i < sorted.length; i++) {
    if (i in sorted) {
      if (!Reflect.set(target, i, sorted[i])) throw new TypeError(`Cannot assign to read only property '${i}'`);
    } else if (!Reflect.deleteProperty(target, i)) {
      throw new TypeError(`Cannot delete property '${i}'`);
    }
  }
}

function evictRemoved(removed: readonly unknown[]): void {
  for (let i = 0; i < removed.length; i++) {
    if (isObject(removed[i])) evictDeep(removed[i]);
  }
}

export function wrapArray<T extends any[]>(arr: T, node: LocationNode): T {
  // reuse existing proxy if available for performance
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy) return cachedProxy as T;
  if (globalSeen.has(arr)) return globalSeen.get(arr);

  // cache for wrapped methods to avoid re-creating them on each call
  const methodCache: { [key: string | symbol]: Function } = {};

  const proxy: T = new Proxy(arr, {
    get(target: T, prop: string | symbol, receiver: any): any {
      if (prop === ReactiveFlags.RAW) return target;
      if (prop === ReactiveFlags.IS_REACTIVE) return true;

      track(target, prop);

      if (methodCache[prop]) {
        return methodCache[prop];
      }

      // handle specific array mutation methods that require custom logic and event emission
      switch (prop) {
        case "sort":
        case "reverse":
        case "fill":
        case "copyWithin": {
          track(target, "length");
          const method = (Array.prototype as any)[prop] as Function;
          methodCache[prop] = function (...args: any[]): T {
            if (prop === "fill" && isObject(args[0])) args[0] = unwrapForStore(args[0]);
            const before = target.slice();
            // the change is made on a copy first: the payload is the array
            // itself, copied as it will be, or refused, before the write
            const after = target.slice();
            method.apply(after, args);
            let changed = false;
            for (let i = 0; i < before.length; i++) {
              if (before[i] !== after[i]) {
                changed = true;
                break;
              }
            }
            // the reorder does not move `target`, so its paths are known before it
            const located = changed ? locate(node) : undefined;
            const event: StateEvent | undefined = located && {
              action: "replace",
              path: located.paths[0],
              oldValue: before,
              newValue: target,
            };
            if (event !== undefined) copyPayloadAfter(event, target, after);
            // the same change on the array, with the native checks (a frozen
            // item throws); only `sort` runs user code, so it is not run twice
            if (prop === "sort") writeSorted(target, after);
            else method.apply(target, args);
            if (!changed) return proxy;
            relinkReorder(node, target, before, prop === "fill" ? [args[0]] : undefined);
            if (event !== undefined) dispatch(located!, event);
            trigger(target, Symbol.iterator);
            evictRemoved(before);
            return proxy;
          };
          return methodCache[prop];
        }
        case "push":
          track(target, "length");
          methodCache[prop] = function (...items: any[]): number {
            unwrapItems(items);
            const oldLength = target.length;
            const located = items.length > 0 ? locate(node) : undefined;
            const event: StateEvent | undefined = located && {
              action: "array-push",
              path: located.paths[0],
              key: oldLength, // start index was the old length
              items: items,
            };
            // copies the payload, or throws, before the write
            if (!copyPayload(event, target)) {
              const after = target.slice();
              after.push(...items);
              copyPayloadAfter(event!, target, after);
            }
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              relinkArray(node, target, oldLength, undefined, items);
              if (event !== undefined) dispatch(located!, event);
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
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "array-pop",
              path: located.paths[0],
              key: poppedIndex,
              oldValue: oldValue,
            };
            if (!copyPayload(event, target)) {
              const after = target.slice();
              after.pop();
              copyPayloadAfter(event!, target, after);
            }
            const result = target.pop();
            const newLength = target.length;
            if (isObject(oldValue)) detachPlace(oldValue, node, poppedIndex);
            if (event !== undefined) dispatch(located!, event);
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
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "array-shift",
              path: located.paths[0],
              key: 0,
              oldValue: oldValue,
            };
            if (!copyPayload(event, target)) {
              const after = target.slice();
              after.shift();
              copyPayloadAfter(event!, target, after);
            }
            const result = target.shift();
            const newLength = target.length;
            relinkArray(node, target, 0, [oldValue]);
            if (event !== undefined) dispatch(located!, event);
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
            unwrapItems(items);
            const oldLength = target.length;
            const located = items.length > 0 ? locate(node) : undefined;
            const event: StateEvent | undefined = located && {
              action: "array-unshift",
              path: located.paths[0],
              key: 0,
              items: items,
            };
            if (!copyPayload(event, target)) {
              const after = target.slice();
              after.unshift(...items);
              copyPayloadAfter(event!, target, after);
            }
            const result = target.unshift(...items);
            const newLength = target.length;
            if (items.length > 0) {
              relinkArray(node, target, 0, undefined, items);
              if (event !== undefined) dispatch(located!, event);
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
          methodCache[prop] = function (...args: any[]): any[] {
            // normalize once, like the spec: the change, the removed items,
            // the new places and the event all use these numbers
            const oldLength = target.length;
            const actualStart = args.length === 0 ? 0 : clampIndex(toIntegerOrInfinity(args[0]), oldLength);
            const actualDeleteCount =
              args.length === 0
                ? 0
                : args.length === 1
                  ? oldLength - actualStart
                  : Math.min(Math.max(toIntegerOrInfinity(args[1]), 0), oldLength - actualStart);
            const items = args.length > 2 ? args.slice(2) : [];
            unwrapItems(items);

            const changes = actualDeleteCount > 0 || items.length > 0;
            const located = changes ? locate(node) : undefined;
            const event: StateEvent | undefined = located && {
              action: "array-splice",
              path: located.paths[0],
              key: actualStart,
              deleteCount: actualDeleteCount,
              items: items.length > 0 ? items : undefined,
              oldValues:
                actualDeleteCount > 0 ? target.slice(actualStart, actualStart + actualDeleteCount) : undefined,
            };
            if (!copyPayload(event, target)) {
              const after = target.slice();
              after.splice(actualStart, actualDeleteCount, ...items);
              copyPayloadAfter(event!, target, after);
            }
            const deletedItems = target.splice(actualStart, actualDeleteCount, ...items);
            const newLength = target.length;

            if (changes) {
              relinkArray(node, target, actualStart, deletedItems, items);
              if (event !== undefined) dispatch(located!, event);
              evictRemoved(deletedItems);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return deletedItems;
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
              return wrapChild(value, node, idx);
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
              return wrapChild(value, node, idx);
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

      // an array index ("0", "17"), parsed once
      const index = arrayIndex(prop);
      if (index >= 0) {
        track(target, prop);
        if (!isObject(value)) return value;
        // recursively wrap nested structures
        return wrapChild(value, node, index);
      }

      // other numeric-looking keys ("1.5", "01") are tracked like indexes
      const isNumericIndex = typeof prop === "string" && !isNaN(parseInt(prop, 10));

      if (isNumericIndex) {
        track(target, prop);
        if (!isObject(value)) return value;
        return wrapChild(value, node, placeKey(prop));
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

      // avoid unnecessary triggers if value hasn't changed. Reading past the end of an
      // array also yields undefined, so also require the prop to already exist —
      // otherwise growing into a brand-new hole with newValue: undefined would be
      // mistaken for a no-op and silently dropped.
      if (oldValue === value && Reflect.has(target, prop)) return true;
      if (
        isObject(oldValue) &&
        isObject(value) &&
        deepEqual(oldValue, value)
      )
        return true;

      // a shorter length removes the items past it
      const truncated =
        prop === "length" && Number(value) < target.length
          ? target.slice(Number(value))
          : undefined;

      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const isNumericIndex =
        typeof prop === "number" ||
        (typeof prop === "string" && !isNaN(parseInt(String(prop))));
      // emit event and trigger effects only if the set was successful and wasn't intercepted by a setter
      // (unless it's a direct numeric index set, which doesn't have a descriptor.set)
      const emits = !descriptor || !descriptor.set || isNumericIndex;
      // direct length grow (e.g. arr.length = N) — emit ascending per-index sets
      // instead of a bare length event so the remote fills every index and never
      // ends up with a hole.
      const grows = prop === "length" && Number(value) > Number(oldValue);

      // the write does not move `target`, so its paths are known before it
      const located = emits ? (grows ? locate(node) : locate(node, prop)) : undefined;
      const event: StateEvent | undefined =
        located === undefined || grows
          ? undefined
          : { action: "set", path: located.paths[0], oldValue, newValue: value };
      // copies the payload, or throws, before the write
      if (!copyPayload(event, target)) {
        const after = target.slice();
        Reflect.set(after, prop, value);
        copyPayloadAfter(event!, target, after);
      }
      const result = Reflect.set(target, prop, value, receiver);

      if (result && emits) {
        // move places before anything can write again (emit may throw)
        if (truncated !== undefined) {
          relinkArray(node, target, target.length, truncated);
        } else if (prop !== "length") {
          const key = placeKey(prop);
          if (isObject(oldValue)) detachPlace(oldValue, node, key);
          if (isObject(value)) attachValue(value, node, key);
        }

        if (grows) {
          if (located !== undefined) {
            const oldLength = Number(oldValue);
            const newLength = Number(value);
            for (let i = oldLength; i < newLength; i++) {
              const index = String(i);
              const paths = located.paths.map((path) => [...path, index]);
              dispatch({ root: located.root, paths }, { action: "set", path: paths[0], newValue: undefined });
            }
          }
        } else if (event !== undefined) {
          dispatch(located!, event);
        }

        if (isObject(oldValue) && oldValue !== value) {
          evictDeep(oldValue);
        }
        if (truncated !== undefined) evictRemoved(truncated);
        trigger(target, prop);
      }
      return result;
    },
    deleteProperty(target: T, prop: string | symbol): boolean {
      const oldValue = (target as any)[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
      const event: StateEvent | undefined = located && { action: "delete", path: located.paths[0], oldValue };
      if (!copyPayload(event, target)) {
        const after = target.slice();
        Reflect.deleteProperty(after, prop);
        copyPayloadAfter(event!, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);

      if (hadProperty && result) {
        if (isObject(oldValue)) detachPlace(oldValue, node, placeKey(prop));
        if (event !== undefined) dispatch(located!, event);
        trigger(target, prop);
        if (isObject(oldValue)) evictDeep(oldValue);
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
