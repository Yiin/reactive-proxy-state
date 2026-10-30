import {
  deepEqual,
  nameKey,
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
import { track, trigger } from "./watch-effect";
import { ReactiveFlags } from "./constants";

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

export function wrapMap<K, V>(map: Map<K, V>, node: LocationNode): Map<K, V> {
  const cachedProxy = wrapperCache.get(map);
  if (cachedProxy) return cachedProxy as Map<K, V>;
  if (globalSeen.has(map)) return globalSeen.get(map);

  const methodCache: { [key: string | symbol]: Function } = {};

  const proxy = new Proxy(map, {
    get(target: Map<K, V>, prop: string | symbol, receiver: any): any {
      if (prop === ReactiveFlags.RAW) return target;
      if (prop === ReactiveFlags.IS_REACTIVE) return true;

      track(target, prop);

      if (
        prop === Symbol.iterator ||
        prop === "entries" ||
        prop === "values" ||
        prop === "keys" ||
        prop === "forEach"
      ) {
        track(target, Symbol.iterator);
      }

      if (methodCache[prop]) {
        return methodCache[prop];
      }

      if (prop === "set") {
        methodCache[prop] = function (key: K, value: V): Map<K, V> {
          if (value != null && typeof value === 'object') value = unwrapForStore(value) as V;
          const existed = target.has(key);
          const oldValue = target.get(key);
          const oldSize = target.size;

          if (oldValue === value) return receiver;
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
          if (event !== undefined && isObject(key)) event.key = nameKey(key, target, !existed);
          // copies the payload, or throws, before the write
          const copied = copyPayload(event, located, target, held);
          if (copied === Copied.Reaches) {
            copyPayloadReaching(event!, located!, target, shallowCopy(target).set(key, value));
          }
          target.set(key, value);
          const newSize = target.size;

          // move places before anything can write again (emit may throw)
          if (isObject(oldValue)) detachPlace(oldValue, node, key);
          if (isObject(value)) attachValue(value, node, key, copied === Copied.Fresh, located && oldValue, held);

          if (event !== undefined) dispatch(located!, event);

          if (!existed) {
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
          } else {
            trigger(target, String(key));
          }

          if (isObject(oldValue)) evictDeep(oldValue);
          return receiver;
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
          if (event !== undefined && isObject(key)) event.key = nameKey(key, target, false);
          if (copyPayload(event, located, target) === Copied.Reaches) {
            const after = shallowCopy(target);
            after.delete(key);
            copyPayloadReaching(event!, located!, target, after);
          }
          const result = target.delete(key);
          const newSize = target.size;

          if (result) {
            if (isObject(oldValue)) detachPlace(oldValue, node, key);

            if (event !== undefined) dispatch(located!, event);

            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
            trigger(target, String(key));
            if (isObject(oldValue)) evictDeep(oldValue);
          }

          return result;
        };
        return methodCache[prop];
      }
      if (prop === "clear") {
        methodCache[prop] = function (): void {
          const oldSize = target.size;
          if (oldSize === 0) return;

          const removed = [...target];
          target.clear();
          const newSize = target.size;

          for (const [key, value] of removed) {
            if (isObject(value)) detachPlace(value, node, key);
          }

          const located = locate(node);
          if (located !== undefined) {
            dispatch(located, {
              action: "map-clear",
              path: located.paths[0],
              key: null,
            });
          }

          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
          }
          for (const [, value] of removed) {
            if (isObject(value)) evictDeep(value);
          }
        };
        return methodCache[prop];
      }
      if (prop === "get") {
        methodCache[prop] = function (key: K): any {
          track(target, String(key));
          const value = target.get(key);

          if (!value || typeof value !== "object") return value;
          return wrapChild(value, node, key);
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        track(target, Symbol.iterator);
        methodCache[prop] = function (key: K): boolean {
          track(target, String(key));
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
        track(target, Symbol.iterator);

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

        methodCache[prop] = function* () {
          for (const [key, value] of target.entries()) {
            if (prop === "keys") {
              yield key;
              continue;
            }
            const wrappedValue = isObject(value) ? wrapChild(value, node, key) : value;
            if (prop === "values") {
              yield wrappedValue;
              continue;
            }
            // An object key has no place in the tree: its proxy emits only
            // if the same object also sits somewhere as a value.
            yield [isObject(key) ? wrapUnplaced(key) : key, wrappedValue];
          }
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
