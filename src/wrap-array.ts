import { StateEvent } from "./types";
import {
  arrayIndex,
  deepEqual,
  hasOwn,
  newMethodCache,
  unwrapForStore,
  wrapperCache,
  globalSeen,
  proxyStats,
  toRaw,
} from "./utils";
import { wrapChild } from "./reactive";
import {
  Copied,
  LocationNode,
  attachValue,
  copyPayload,
  deliver,
  detachPlace,
  dispatch,
  evictDeep,
  heldItems,
  locate,
  relinkArray,
  relinkReorder,
  writesThroughSetter,
  copyPayloadAfter,
  copyPayloadReaching,
} from "./location";
import { beginWrite, endWrite, activeEffect, track, trigger, triggerArray, triggerSplice } from "./watch-effect";
import { ReactiveFlags } from "./constants";

// avoid repeated typeof checks
function isObject(v: any): v is object {
  return v && typeof v === "object";
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
 * A reorder (`sort`, `reverse`, `fill`, `copyWithin`) planned on a copy:
 * `after` is the array as the reorder leaves it, and the reorder writes or
 * deletes the indexes from `first` up to `last`, except `skip`, the ones
 * native code writes.
 */
interface Reorder {
  after: unknown[];
  first: number;
  last: number;
  skip: number;
}

/**
 * Plan `method` (a reorder) with `args` on a copy of `target`. Bounds are
 * converted once, in native order, after the length is read; the copy and
 * the write use the same numbers. `sort` runs its comparator here, on the
 * copy, and returns what native sort returns: the items it read, sorted,
 * then any tail the comparator appended.
 */
function planReorder(target: unknown[], prop: string | symbol, method: Function, args: any[]): Reorder {
  const length = target.length;
  if (prop === "fill" || prop === "copyWithin") {
    const fill = prop === "fill";
    const to = fill ? 0 : clampIndex(toIntegerOrInfinity(args[0]), length);
    const start = clampIndex(toIntegerOrInfinity(args[1]), length);
    const end = args[2] === undefined ? length : clampIndex(toIntegerOrInfinity(args[2]), length);
    // a bound's valueOf may have changed the array: the copy is taken now
    const after = target.slice();
    method.call(after, fill ? args[0] : to, start, end);
    const size = after.length;
    if (fill) return { after, first: Math.min(start, size), last: Math.min(end, size), skip: -1 };
    const from = Math.min(to, size);
    const count = Math.min(Math.min(end, size) - Math.min(start, size), size - from);
    return { after, first: from, last: from + Math.max(count, 0), skip: -1 };
  }
  const after = target.slice();
  method.apply(after, args);
  if (prop === "reverse") {
    // the middle of an odd length stays where it is
    return { after, first: 0, last: length, skip: length % 2 === 1 ? (length - 1) / 2 : -1 };
  }
  // sort: an array shorter than two is not written, as the engine does
  const sorted = length < 2 ? 0 : length;
  for (let i = length; i < target.length; i++) {
    if (i in target) after[i] = target[i];
    else after.length = i + 1;
  }
  return { after, first: 0, last: sorted, skip: -1 };
}

/**
 * Does this code run in strict mode? The ES module bundle does; the
 * CommonJS bundle does not, and there a failed write is silent.
 */
const strictWrites = (function (this: unknown) {
  return this === undefined;
})();

/**
 * Throw a TypeError, before any write, when `target` would refuse a write
 * of `reorder`: a read-only index, a hole in a non-extensible array, or a
 * non-configurable index to delete. Writing an index the value it holds
 * changes nothing; in strict mode it throws a TypeError exactly when the
 * index is read-only. Without strict mode, `Reflect.set` says so, slower.
 */
function checkReorder(target: unknown[], reorder: Reorder): void {
  const { after, first, last, skip } = reorder;
  let extensible: boolean | undefined;
  for (let i = first; i < last; i++) {
    if (i === skip) continue;
    if (i in after) {
      if (i in target) {
        if (strictWrites) target[i] = target[i];
        else if (!Reflect.set(target, i, target[i])) throw new TypeError(`Cannot assign to read only property '${i}' of array`);
      } else if (!(extensible ??= Object.isExtensible(target))) {
        throw new TypeError(`Cannot add property ${i}, array is not extensible`);
      }
    } else if (i in target && !Reflect.getOwnPropertyDescriptor(target, i)!.configurable) {
      throw new TypeError(`Cannot delete property '${i}' of array`);
    }
  }
}

/**
 * Does `after` differ from `target` anywhere: a value (as `Object.is` tells
 * them apart: NaN is NaN, 0 is not -0) or a hole? Written without
 * `Object.is`, which made a cold 400-item reverse 60% slower on arm64.
 */
function reorderChanges(target: unknown[], after: unknown[]): boolean {
  if (after.length !== target.length) return true;
  for (let i = 0; i < after.length; i++) {
    const value = after[i];
    const current = target[i];
    if (value !== current) {
      if (value === value || current === current) return true; // not both NaN
    } else if (value === 0) {
      if (1 / (value as number) !== 1 / (current as number)) return true; // 0 and -0
    } else if (value === undefined && i in after !== i in target) {
      return true; // a hole and an undefined
    }
  }
  return false;
}

/** Make the writes of `reorder` (checked by `checkReorder`) on `target`. */
function writeReorder(target: unknown[], reorder: Reorder): void {
  const { after, first, last, skip } = reorder;
  for (let i = first; i < last; i++) {
    if (i === skip) continue;
    if (i in after) target[i] = after[i];
    else delete target[i];
  }
}

/** What the get trap holds before it reads the value. */
const notRead = Symbol("notRead");

/**
 * Does a write of `prop`, a name, to the array call a setter: its own, or
 * one along its prototype chain (a subclass, `Array.prototype`)?
 */
function callsSetter(target: unknown[], prop: string | symbol, node: LocationNode): boolean {
  if (hasOwn.call(target, prop)) return writesThroughSetter(target, prop, node);
  for (let proto = Object.getPrototypeOf(target); proto !== null; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(proto, prop);
    if (descriptor !== undefined) return descriptor.set !== undefined;
  }
  return false;
}

/** Is `prop` a name: no index, no numeric-looking key ("1.5", "01"), not `length`? */
function isName(prop: string | symbol): boolean {
  return typeof prop === "symbol" || (prop !== "length" && isNaN(parseInt(prop)));
}

/** What a splice that removes nothing removed. */
const noItems: readonly unknown[] = [];

/**
 * `method` run on `target`, an array method that reads all items: it
 * tracks them when it runs, also when it was read before an effect.
 */
function readerOf(target: unknown[], method: Function): Function {
  return function (this: unknown) {
    trackIteration(target);
    return method.apply(target, arguments);
  };
}

function evictRemoved(removed: readonly unknown[]): void {
  for (let i = 0; i < removed.length; i++) {
    if (isObject(removed[i])) evictDeep(removed[i]);
  }
}

/**
 * Track what a loop over `target` reads: its items and its length. Every
 * write of an index or the length triggers `Symbol.iterator`.
 */
function trackIteration(target: unknown[]): void {
  if (activeEffect !== null) track(target, Symbol.iterator);
}

/** What each step of an array iterator gives: the item, its index, or both. */
const enum IteratorKind {
  Values,
  Keys,
  Entries,
}

/**
 * The iterator of `[Symbol.iterator]()`, `values()`, `keys()` and `entries()` of an
 * array proxy, so also of `for...of`, spread, `Array.from` and
 * destructuring. It steps like the native one: the length is read at every
 * step, and once done it stays done. An item is what an index read gives:
 * the proxy of an object, placed at its index, so a write through it emits
 * at the index the item holds then, also after a splice moved it. 2.0.0 and
 * 3.0.0 iterated the raw array, and a write through a raw item sent nothing.
 */
class ArrayProxyIterator {
  private target: unknown[] | undefined;
  private index = 0;

  constructor(target: unknown[], private readonly node: LocationNode, private readonly kind: IteratorKind) {
    this.target = target;
  }

  next(): IteratorResult<unknown> {
    const target = this.target;
    if (target !== undefined) {
      // a step tracks, also of an iterator made before the effect ran
      if (activeEffect !== null) track(target, Symbol.iterator);
      const index = this.index;
      if (index < target.length) {
        this.index = index + 1;
        const kind = this.kind;
        if (kind === IteratorKind.Keys) return { value: index, done: false };
        const value = target[index];
        const item = isObject(value) ? wrapChild(value, this.node, index) : value;
        return { value: kind === IteratorKind.Values ? item : [index, item], done: false };
      }
      this.target = undefined;
    }
    return { value: undefined, done: true };
  }
}

// %IteratorPrototype% gives `[Symbol.iterator]() { return this }` and the
// iterator helpers (`map`, `toArray`) where the engine has them
Object.setPrototypeOf(
  ArrayProxyIterator.prototype,
  Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()))
);

export function wrapArray<T extends any[]>(arr: T, node: LocationNode): T {
  // reuse existing proxy if available for performance
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy) return cachedProxy as T;
  if (globalSeen.has(arr)) return globalSeen.get(arr);

  // cache for wrapped methods to avoid re-creating them on each call
  const methodCache = newMethodCache();
  // readers of functions that are not Array.prototype's, with their function
  let otherReaders: Map<string | symbol, [Function, Function]> | undefined;

  const handler = {
    get(target: T, prop: string | symbol, receiver: any): any {
      if (prop === ReactiveFlags.RAW) return target;
      if (prop === ReactiveFlags.IS_REACTIVE) return true;

      track(target, prop);

      // Index reads come first: they are the most frequent, and an index
      // never names a cached method. A key whose first character is no digit
      // is no index, and this test needs no call: calling `arrayIndex` for
      // every key made method reads 2.5x slower on Bun.
      if (typeof prop === "string") {
        const first = prop.charCodeAt(0);
        if (first <= 57 && first >= 48) {
          // an array index ("0", "17"), parsed once
          const index = arrayIndex(prop);
          if (index >= 0) {
            const value = Reflect.get(target, prop, receiver);
            if (!isObject(value)) return value;
            // recursively wrap nested structures
            return wrapChild(value, node, index);
          }
        } else if (prop === "length") {
          return Reflect.get(target, prop, receiver);
        }
      }

      const cached = methodCache[prop];
      if (cached !== undefined) return cached;
      // a function read before that is not Array.prototype's (see below).
      // The value read here is the one the tail uses: a getter runs once.
      let read: unknown = notRead;
      if (otherReaders !== undefined) {
        const kept = otherReaders.get(prop);
        if (kept !== undefined) {
          read = Reflect.get(target, prop, receiver);
          if (kept[0] === read) return kept[1];
        }
      }

      // handle specific array mutation methods that require custom logic and event emission
      switch (prop) {
        case "sort":
        case "reverse":
        case "fill":
        case "copyWithin": {
          if (hasOwn.call(target, prop)) break;
          const method = (Array.prototype as any)[prop] as Function;
          methodCache[prop] = function (...args: any[]): T {
            if (prop === "fill" && isObject(args[0])) args[0] = unwrapForStore(args[0]);
            // the change is planned on a copy first: the payload is the array
            // itself, copied as it will be, or refused, before the write
            const reorder = planReorder(target, prop, method, args);
            // what the write replaces, after anything the comparator wrote
            const before = target.slice();
            checkReorder(target, reorder);
            const after = reorder.after;
            if (!reorderChanges(target, after)) return proxy;
            // the reorder does not move `target`, so its paths are known before it
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "replace",
              path: located.paths[0],
              oldValue: before,
              newValue: target,
            };
            if (event !== undefined) copyPayloadAfter(event, located!, target, after);
            writeReorder(target, reorder);
            relinkReorder(node, target, before, prop === "fill" ? [args[0]] : undefined);
            beginWrite();
            try {
              triggerArray(target, reorder.first, reorder.last, false, before);
              if (event !== undefined) dispatch(located!, event);
            } finally {
              try {
                evictRemoved(before);
              } finally {
                endWrite();
              }
            }
            return proxy;
          };
          return methodCache[prop];
        }
        case "push":
          if (hasOwn.call(target, prop)) break;
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
            const copied = copyPayload(event, located, target);
            if (copied === Copied.Reaches) {
              const after = target.slice();
              after.push(...items);
              copyPayloadReaching(event!, located!, target, after);
            }
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              relinkArray(node, target, oldLength, undefined, items, copied === Copied.Fresh);
              beginWrite();
              try {
                triggerArray(target, oldLength, newLength, oldLength !== newLength);
                if (event !== undefined) dispatch(located!, event);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "pop":
          if (hasOwn.call(target, prop)) break;
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
            if (copyPayload(event, located, target) === Copied.Reaches) {
              const after = target.slice();
              after.pop();
              copyPayloadReaching(event!, located!, target, after);
            }
            const result = target.pop();
            const newLength = target.length;
            if (isObject(oldValue)) detachPlace(oldValue, node, poppedIndex);
            beginWrite();
            try {
              triggerArray(target, newLength, oldLength, oldLength !== newLength);
              if (event !== undefined) dispatch(located!, event);
            } finally {
              try {
                if (isObject(oldValue)) evictDeep(oldValue);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "shift":
          if (hasOwn.call(target, prop)) break;
          methodCache[prop] = function (): any {
            if (target.length === 0) return undefined;
            const oldLength = target.length;
            const oldValue = target[0];
            // what left index 0: the item, or a hole
            const removed = 0 in target ? [oldValue] : new Array(1);
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "array-shift",
              path: located.paths[0],
              key: 0,
              oldValue: oldValue,
            };
            if (copyPayload(event, located, target) === Copied.Reaches) {
              const after = target.slice();
              after.shift();
              copyPayloadReaching(event!, located!, target, after);
            }
            const result = target.shift();
            relinkArray(node, target, 0, removed);
            beginWrite();
            try {
              triggerSplice(target, 0, removed, 0, oldLength);
              if (event !== undefined) dispatch(located!, event);
            } finally {
              try {
                if (isObject(oldValue)) evictDeep(oldValue);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "unshift":
          if (hasOwn.call(target, prop)) break;
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
            const copied = copyPayload(event, located, target);
            if (copied === Copied.Reaches) {
              const after = target.slice();
              after.unshift(...items);
              copyPayloadReaching(event!, located!, target, after);
            }
            const result = target.unshift(...items);
            if (items.length > 0) {
              relinkArray(node, target, 0, undefined, items, copied === Copied.Fresh);
              beginWrite();
              try {
                triggerSplice(target, 0, noItems, items.length, oldLength);
                if (event !== undefined) dispatch(located!, event);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "splice":
          if (hasOwn.call(target, prop)) break;
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
            const copied = copyPayload(event, located, target);
            if (copied === Copied.Reaches) {
              const after = target.slice();
              after.splice(actualStart, actualDeleteCount, ...items);
              copyPayloadReaching(event!, located!, target, after);
            }
            // keeps the holes it removed
            const deletedItems = target.splice(actualStart, actualDeleteCount, ...items);

            if (changes) {
              relinkArray(node, target, actualStart, deletedItems, items, copied === Copied.Fresh);
              beginWrite();
              try {
                triggerSplice(target, actualStart, deletedItems, items.length, oldLength);
                if (event !== undefined) dispatch(located!, event);
              } finally {
                try {
                  evictRemoved(deletedItems);
                } finally {
                  endWrite();
                }
              }
            }
            return deletedItems;
          };
          return methodCache[prop];
        // special wrapper for find to ensure returned element is reactive
        case "find":
        case "findLast": {
          if (hasOwn.call(target, prop)) break;
          const findIndex = prop === "find" ? Array.prototype.findIndex : Array.prototype.findLastIndex;
          methodCache[prop] = function (
            predicate: (value: any, index: number, obj: any[]) => boolean,
            thisArg?: any
          ) {
            trackIteration(target);
            const idx = findIndex.call(target, predicate, thisArg);
            if (idx === -1) return undefined;
            const value = target[idx];
            if (!isObject(value)) return value;
            return wrapChild(value, node, idx);
          };
          return methodCache[prop];
        }
        // the proxies that index reads, `find` and iteration give are found
        // where their raw objects are
        case "indexOf":
        case "lastIndexOf":
        case "includes": {
          if (hasOwn.call(target, prop)) break;
          const method = (Array.prototype as any)[prop] as Function;
          methodCache[prop] = function (searched: unknown, fromIndex?: unknown): unknown {
            trackIteration(target);
            const from = arguments.length > 1;
            const result = from ? method.call(target, searched, fromIndex) : method.call(target, searched);
            if (result !== -1 && result !== false) return result;
            if (!isObject(searched) || !(searched as any)[ReactiveFlags.IS_REACTIVE]) return result;
            const raw = toRaw(searched);
            return from ? method.call(target, raw, fromIndex) : method.call(target, raw);
          };
          return methodCache[prop];
        }
        // special wrapper for at to ensure returned element is reactive
        case "at": {
          if (hasOwn.call(target, prop)) break;
          methodCache[prop] = function (index: number): any {
            trackIteration(target);
            // emulate Array.prototype.at to support negative indexes
            let idx = Number(index);
            if (!Number.isInteger(idx)) idx = Math.trunc(idx);
            if (idx < 0) idx = target.length + idx;
            if (idx < 0 || idx >= target.length) return undefined;

            const value = target[idx];
            if (!isObject(value)) return value;
            return wrapChild(value, node, idx);
          };
          return methodCache[prop];
        }
        case Symbol.iterator:
        case "values":
        case "entries":
        case "keys": {
          if (hasOwn.call(target, prop)) break;
          const kind = prop === "entries" ? IteratorKind.Entries : prop === "keys" ? IteratorKind.Keys : IteratorKind.Values;
          methodCache[prop] = function (): ArrayProxyIterator {
            trackIteration(target);
            return new ArrayProxyIterator(target, node, kind);
          };
          return methodCache[prop];
        }
      }

      const value = read !== notRead ? read : Reflect.get(target, prop, receiver);

      // other numeric-looking keys ("1.5", "01") are tracked like indexes
      const isNumericIndex = typeof prop === "string" && !isNaN(parseInt(prop, 10));

      if (isNumericIndex) {
        if (!isObject(value)) return value;
        return wrapChild(value, node, placeKey(prop));
      }

      // functions run on the raw target. The methods left (`map`, `filter`,
      // `slice`, `join`, `with` and the rest) read the whole array,
      // and track it when they run, not when they are read: until 3.0.2
      // `const slice = list.slice` before an effect gave a slice that tracked
      // nothing. `constructor` is a class, and `valueOf` gives its receiver:
      // both keep the proxy.
      if (typeof value === "function") {
        if (prop === "constructor" || prop === "valueOf") return value;
        // Array.prototype's own methods, one per proxy: a change to
        // Array.prototype after a proxy read the method is not seen
        if (hasOwn.call(Array.prototype, prop) && (Array.prototype as any)[prop] === value) {
          return (methodCache[prop] = readerOf(target, value));
        }
        // any other function (Object.prototype's, a subclass's, the array's
        // own) is read each time, and its reader is kept while it is the same
        const method = readerOf(target, value);
        (otherReaders ??= new Map()).set(prop, [value, method]);
        return method;
      }
      return value;
    },
    // `descriptor`: the write is `Object.defineProperty` with a value (see below)
    set(target: T, prop: string | symbol, value: any, receiver: any, descriptor?: PropertyDescriptor): boolean {
      // Another receiver (an outer proxy, `Reflect.set` with a receiver, an
      // object that inherits from the proxy) gets the ordinary write. When
      // the write lands on this array, it ends in the `defineProperty` trap
      // below, which unwraps the value and sends the event once. 3.0.12 also
      // sent it here: twice. A write that calls a setter, own or inherited,
      // goes on below, as on the proxy, with the receiver as `this`.
      const foreign = receiver !== proxy;
      if (foreign && !(isName(prop) && callsSetter(target, prop, node))) return Reflect.set(target, prop, value, receiver);
      if (isObject(value)) value = unwrapForStore(value);

      const oldValue = (target as any)[prop];

      // avoid unnecessary triggers if value hasn't changed. Reading past the end of an
      // array also yields undefined, so also require the prop to already exist —
      // otherwise growing into a brand-new hole with newValue: undefined would be
      // mistaken for a no-op and silently dropped. A define still sets its flags.
      if (
        (oldValue === value && Reflect.has(target, prop)) ||
        (isObject(oldValue) && isObject(value) && deepEqual(oldValue, value))
      )
        return descriptor === undefined || Reflect.defineProperty(target, prop, { ...descriptor, value: oldValue });
      // NaN in place of NaN is sent, as until now, but changes nothing an effect reads
      const sameNaN = oldValue !== oldValue && value !== value && Reflect.has(target, prop);

      // a shorter length removes the items past it
      const truncated =
        prop === "length" && Number(value) < target.length
          ? target.slice(Number(value))
          : undefined;

      const index = arrayIndex(prop);
      // only a name can call a setter: an index or `length` is written as data
      const throughSetter = foreign || (index < 0 && isName(prop) && callsSetter(target, prop, node));
      if (throughSetter && descriptor === undefined) {
        // A setter, own or inherited, runs with the proxy (or the other
        // receiver) as `this`: its own writes send their events, and the
        // write of its key sends none. An inherited setter also reruns the
        // readers of its key, as until 3.0.12: its getter can read what no
        // proxy sees. One batch: an effect that reads the key and what the
        // setter writes runs once.
        if (hasOwn.call(target, prop)) return Reflect.set(target, prop, value, receiver);
        beginWrite();
        try {
          const result = Reflect.set(target, prop, value, receiver);
          if (result) trigger(target, prop);
          return result;
        } finally {
          endWrite();
        }
      }
      // direct length grow (e.g. arr.length = N) — emit ascending per-index sets
      // instead of a bare length event so the remote fills every index and never
      // ends up with a hole.
      const grows = prop === "length" && Number(value) > Number(oldValue);

      // the write does not move `target`, so its paths are known before it
      const located = grows ? locate(node) : locate(node, prop);
      const event: StateEvent | undefined =
        located === undefined || grows
          ? undefined
          : { action: "set", path: located.paths[0], oldValue, newValue: value };
      const held = event !== undefined ? heldItems(value, oldValue) : undefined;
      // copies the payload, or throws, before the write
      const copied = copyPayload(event, located, target, held);
      if (copied === Copied.Reaches) {
        const after = target.slice();
        Reflect.set(after, prop, value);
        copyPayloadReaching(event!, located!, target, after);
      }
      const oldLength = target.length;
      // The write goes to the target: through the proxy it would end in the
      // proxy's `defineProperty` trap. A define keeps its descriptor unless
      // the value was unwrapped.
      const result =
        descriptor !== undefined
          ? Reflect.defineProperty(target, prop, descriptor.value === value ? descriptor : { ...descriptor, value })
          : Reflect.set(target, prop, value);

      if (result) {
        // move places before anything can write again (emit may throw)
        if (truncated !== undefined) {
          relinkArray(node, target, target.length, truncated);
        } else if (prop !== "length") {
          const key = placeKey(prop);
          if (isObject(oldValue)) detachPlace(oldValue, node, key);
          if (isObject(value)) attachValue(value, node, key, copied === Copied.Fresh, located && oldValue, held);
        }

        beginWrite();
        try {
          const newLength = target.length;
          if (sameNaN) {
            // nothing to trigger
          } else if (index >= 0) {
            // a write past the end makes the array longer
            triggerArray(target, index, index + 1, newLength !== oldLength);
          } else if (prop === "length") {
            // a shorter length removes the indexes past it
            if (newLength !== oldLength) triggerArray(target, newLength, oldLength, true);
          } else {
            // an own function in place of an array method is read from now on
            if (methodCache[prop] !== undefined) methodCache[prop] = undefined;
            trigger(target, prop);
          }
          if (grows) {
            if (located !== undefined) {
              // one event per new index and place, delivered as one write
              const oldLength = Number(oldValue);
              const newLength = Number(value);
              const events: StateEvent[] = [];
              for (let i = oldLength; i < newLength; i++) {
                const index = String(i);
                for (let j = 0; j < located.paths.length; j++) {
                  events.push({ action: "set", path: [...located.paths[j], index], newValue: undefined });
                }
              }
              if (events.length > 0) deliver(located.root, events);
            }
          } else if (event !== undefined) {
            dispatch(located!, event);
          }
        } finally {
          try {
            if (isObject(oldValue) && oldValue !== value) {
              evictDeep(oldValue);
            }
            if (truncated !== undefined) evictRemoved(truncated);
          } finally {
            endWrite();
          }
        }
      }
      return result;
    },
    deleteProperty(target: T, prop: string | symbol): boolean {
      const oldValue = (target as any)[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
      const event: StateEvent | undefined = located && { action: "delete", path: located.paths[0], oldValue };
      if (copyPayload(event, located, target) === Copied.Reaches) {
        const after = target.slice();
        Reflect.deleteProperty(after, prop);
        copyPayloadReaching(event!, located!, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);

      if (hadProperty && result) {
        if (isObject(oldValue)) detachPlace(oldValue, node, placeKey(prop));
        beginWrite();
        try {
          const index = arrayIndex(prop);
          if (index >= 0) triggerArray(target, index, index + 1, false);
          else {
            if (methodCache[prop] !== undefined) methodCache[prop] = undefined;
            trigger(target, prop);
          }
          if (event !== undefined) dispatch(located!, event);
        } finally {
          try {
            if (isObject(oldValue)) evictDeep(oldValue);
          } finally {
            endWrite();
          }
        }
      }
      return result;
    },
    defineProperty(target: T, prop: string | symbol, descriptor: PropertyDescriptor): boolean {
      // a value is written as `set` writes it: the same event, and the same effects rerun
      if ("value" in descriptor) return handler.set(target, prop, descriptor.value, proxy, descriptor);
      if (!("get" in descriptor) && !("set" in descriptor)) {
        // new flags alone on a key the array has change no value
        // (`Object.freeze` ends here for each key), unless `writable` makes
        // an accessor a data property
        const current = Reflect.getOwnPropertyDescriptor(target, prop);
        if (current !== undefined && ("value" in current || !("writable" in descriptor)))
          return Reflect.defineProperty(target, prop, descriptor);
        // a new key, or an accessor made data: a write of `undefined`
        return handler.set(target, prop, undefined, proxy, descriptor);
      }
      // an accessor: effects rerun, and no event is sent
      // (an accessor added later is outside the supported input, see `writesThroughSetter`)
      const oldLength = target.length;
      const result = Reflect.defineProperty(target, prop, descriptor);
      if (result) {
        node.dataOnly = undefined;
        beginWrite();
        try {
          const index = arrayIndex(prop);
          if (index >= 0) triggerArray(target, index, index + 1, target.length !== oldLength);
          else {
            if (methodCache[prop] !== undefined) methodCache[prop] = undefined;
            trigger(target, prop);
          }
        } finally {
          endWrite();
        }
      }
      return result;
    },
  };
  const proxy: T = new Proxy(arr, handler);

  globalSeen.set(arr, proxy);
  wrapperCache.set(arr, proxy);
  proxyStats.created++;
  proxyStats.arrays++;
  return proxy;
}
