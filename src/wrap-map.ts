import {
  deepEqual,
  forgetReplicaIndex,
  hasOwn,
  indexAdded,
  indexRemoved,
  nameKey,
  watchIndex,
  unwrapForStore,
  wrapperCache,
  globalSeen,
  proxyStats,
} from "./utils";
import { wrapChild, wrapUnplaced } from "./reactive";
import {
  Copied,
  LocationNode,
  attachValue,
  copyPayload,
  detachPlace,
  dispatch,
  evictDeep,
  heldItems,
  locate,
  copyPayloadReaching,
  shallowCopy,
} from "./location";
import type { StateEvent } from "./types";
import { activeEffect, trackingVersion, beginWrite, endWrite, track, trackMapKeys, trackMapValues, trackMembership, trackEntry, triggerCleared, triggerCollection } from "./watch-effect";
import { ReactiveFlags } from "./constants";

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

class MapProxyIterator<K, V> {
  private target: Map<K, V> | undefined;
  private trackedAt = -1;
  private readonly iterator: MapIterator<[K, V]>;

  constructor(target: Map<K, V>, private readonly node: LocationNode, private readonly kind: string | symbol) {
    this.target = target;
    this.iterator = target.entries();
  }

  next(): IteratorResult<unknown> {
    if (this.target === undefined) return { value: undefined, done: true };
    if (activeEffect !== null && this.trackedAt !== trackingVersion) {
      if (this.kind === "keys") trackMapKeys(this.target);
      else trackMapValues(this.target);
      this.trackedAt = trackingVersion;
    }
    const step = this.iterator.next();
    if (step.done) {
      this.target = undefined;
      return step;
    }
    const [key, value] = step.value;
    if (this.kind === "keys") return { value: key, done: false };
    const wrapped = isObject(value) ? wrapChild(value, this.node, key) : value;
    return { value: this.kind === "values" ? wrapped : [isObject(key) ? wrapUnplaced(key) : key, wrapped], done: false };
  }
}

Object.setPrototypeOf(
  MapProxyIterator.prototype,
  Object.getPrototypeOf(Object.getPrototypeOf(new Map().entries()))
);

export function wrapMap<K, V>(map: Map<K, V>, node: LocationNode): Map<K, V> {
  const cachedProxy = wrapperCache.get(map);
  if (cachedProxy) return cachedProxy as Map<K, V>;
  if (globalSeen.has(map)) return globalSeen.get(map);

  // only its own entries count: until 3.0.1 a read of `constructor` found Object.prototype's in it
  const methodCache: { [key: string | symbol]: Function } = {};
  // the proxy keeps the collection's index by token, once it has one
  const watch = watchIndex(map);

  const proxy = new Proxy(map, {
    get(target: Map<K, V>, prop: string | symbol, receiver: any): any {
      if (prop === ReactiveFlags.RAW) return target;
      if (prop === ReactiveFlags.IS_REACTIVE) return true;

      // methods track what they read when they run, not when they are read:
      // until 3.0.2 `const values = map.values` before an effect gave values
      // that tracked nothing
      const cached = methodCache[prop];
      if (cached !== undefined && hasOwn.call(methodCache, prop)) return cached;

      if (prop === "set") {
        methodCache[prop] = function (key: K, value: V): Map<K, V> {
          if (value != null && typeof value === 'object') value = unwrapForStore(value) as V;
          const existed = target.has(key);
          const oldValue = target.get(key);
          const oldSize = target.size;

          // a new key holding undefined is a change
          if (oldValue === value && existed) return receiver;
          if (
            oldValue &&
            typeof oldValue === "object" &&
            value &&
            typeof value === "object" &&
            deepEqual(oldValue, value)
          )
            return receiver;

          // the write does not move `target`, so its paths are known before it
          const located = locate(node);
          const event: StateEvent | undefined = located && {
            action: "map-set",
            path: located.paths[0],
            key,
            oldValue,
            newValue: value,
          };
          const held = located && heldItems(value, oldValue);
          // the event names an object key itself: its replica finds its copy by the key's token
          if (event !== undefined && isObject(key)) nameKey(event, key, target, !existed);
          // copies the payload, or throws, before the write
          const copied = copyPayload(event, located, target, held);
          if (copied === Copied.Reaches) {
            copyPayloadReaching(event!, located!, target, shallowCopy(target).set(key, value));
          }
          target.set(key, value);
          const newSize = target.size;
          if (!existed && watch.indexed) indexAdded(target, key);

          // move places before anything can write again (emit may throw)
          if (isObject(oldValue)) detachPlace(oldValue, node, key);
          if (isObject(value)) attachValue(value, node, key, copied === Copied.Fresh, located && oldValue, held);

          beginWrite();
          try {
            if (!existed || oldValue === oldValue || value === value) triggerCollection(target, key, oldSize !== newSize);
            if (event !== undefined) dispatch(located!, event);
          } finally {
            try {

              if (isObject(oldValue)) evictDeep(oldValue);
            } finally {
              endWrite();
            }
          }
          return receiver;
        };
        return methodCache[prop];
      }
      // only where the raw map has them: a feature check on the proxy
      // answers as on the map
      if ((prop === "getOrInsert" || prop === "getOrInsertComputed") && typeof (target as any)[prop] === "function") {
        methodCache[prop] = function (key: K, value: V | ((key: K) => V)): V | undefined {
          if (prop === "getOrInsertComputed" && typeof value !== "function") {
            throw new TypeError("Map.getOrInsertComputed callback must be a function");
          }
          if (Object.is(key, -0)) key = 0 as K;
          if (proxy.has(key)) return proxy.get(key);
          const inserted = prop === "getOrInsertComputed" ? (value as (key: K) => V)(key) : value as V;
          const stored = isObject(inserted) ? unwrapForStore(inserted) : inserted;
          proxy.set(key, stored as V);
          if (!isObject(stored)) return stored;
          return target.get(key) === stored ? wrapChild(stored, node, key) : wrapUnplaced(stored);
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function (key: K): boolean {
          const existed = target.has(key);
          if (!existed) return false;

          const oldValue = target.get(key);
          const oldSize = target.size;

          const located = locate(node);
          const event: StateEvent | undefined = located && {
            action: "map-delete",
            path: located.paths[0],
            key,
            oldValue,
          };
          if (event !== undefined && isObject(key)) nameKey(event, key, target, false);
          if (copyPayload(event, located, target) === Copied.Reaches) {
            const after = shallowCopy(target);
            after.delete(key);
            copyPayloadReaching(event!, located!, target, after);
          }
          const result = target.delete(key);
          const newSize = target.size;

          if (result) {
            if (watch.indexed) indexRemoved(target, key);
            if (isObject(oldValue)) detachPlace(oldValue, node, key);

            beginWrite();
            try {
              triggerCollection(target, key, oldSize !== newSize);
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
        };
        return methodCache[prop];
      }
      if (prop === "clear") {
        methodCache[prop] = function (): void {
          const oldSize = target.size;
          if (oldSize === 0) return;

          const located = locate(node);
          const removed = [...target];
          target.clear();
          if (watch.indexed) forgetReplicaIndex(target);

          for (const [key, value] of removed) {
            if (isObject(value)) detachPlace(value, node, key);
          }

          beginWrite();
          try {
            triggerCleared(target, removed.map(([key]) => key));
            if (located !== undefined) {
              dispatch(located, {
                action: "map-clear",
                path: located.paths[0],
                key: null,
              });
            }
          } finally {
            try {
              for (const [, value] of removed) {
                if (isObject(value)) evictDeep(value);
              }
            } finally {
              endWrite();
            }
          }
        };
        return methodCache[prop];
      }
      if (prop === "get") {
        methodCache[prop] = function (key: K): any {
          trackEntry(target, key);
          const value = target.get(key);

          if (!value || typeof value !== "object") return value;
          return wrapChild(value, node, key);
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        methodCache[prop] = function (key: K): boolean {
          trackMembership(target, key);
          return target.has(key);
        }.bind(target);
        return methodCache[prop];
      }

      if (
        prop === Symbol.iterator ||
        prop === "entries" ||
        prop === "values" ||
        prop === "keys" ||
        prop === "forEach"
      ) {
        if (prop === "forEach") {
          methodCache[prop] = (
            callbackfn: (value: V, key: K, map: Map<K, V>) => void,
            thisArg?: any
          ): void => {
            const entriesIterator = proxy.entries();
            for (const [key, value] of entriesIterator) {
              callbackfn.call(thisArg, value, key, proxy);
            }
          };
          return methodCache[prop];
        }

        methodCache[prop] = function () {
          return new MapProxyIterator(target, node, prop);
        };
        return methodCache[prop];
      }

      if (prop === "size") {
        track(target, "size");
        return target.size;
      }

      // Forward constructor property for instanceof checks
      if (prop === "constructor") {
        return Map;
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        // `valueOf` gives its receiver: the proxy
        if (prop === "valueOf") return value;
        return value.bind(target);
      }
      return value;
    },
  });

  globalSeen.set(map, proxy);
  wrapperCache.set(map, proxy);
  proxyStats.created++;
  proxyStats.maps++;
  return proxy;
}
