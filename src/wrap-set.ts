import { forgetReplicaIndex, indexAdded, indexRemoved, unwrapForStore, watchIndex, wrapperCache, globalSeen, proxyStats } from "./utils";
import { wrapChild } from "./reactive";
import {
  Copied,
  LocationNode,
  attachValue,
  copyPayload,
  detachPlace,
  dispatch,
  evictDeep,
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

export function wrapSet<T>(set: Set<T>, node: LocationNode): Set<T> {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy) return cachedProxy as Set<T>;
  if (globalSeen.has(set)) return globalSeen.get(set);

  const methodCache: { [key: string | symbol]: Function } = {};
  // the proxy keeps the collection's index by token, once it has one
  const watch = watchIndex(set);

  const proxy = new Proxy(set, {
    get(target: Set<T>, prop: string | symbol, receiver: any): any {
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

      if (prop === "add") {
        methodCache[prop] = function (value: T): Set<T> {
          if (value != null && typeof value === 'object') value = unwrapForStore(value) as T;
          const existed = target.has(value);
          const oldSize = target.size;

          if (!existed) {
            // the write does not move `target`, so its paths are known before it
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "set-add",
              path: located.paths[0],
              value: value,
            };
            // copies the payload, or throws, before the write
            const copied = copyPayload(event, located, target);
            if (copied === Copied.Reaches) {
              copyPayloadReaching(event!, located!, target, shallowCopy(target).add(value));
            }
            target.add(value);
            const newSize = target.size;
            if (watch.indexed) indexAdded(target, value);

            if (isObject(value)) attachValue(value, node, undefined, copied === Copied.Fresh);
            if (event !== undefined) dispatch(located!, event);
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
          }
          return receiver;
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function (value: T): boolean {
          const existed = target.has(value);
          const oldSize = target.size;

          if (existed) {
            const oldValue = value;
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "set-delete",
              path: located.paths[0],
              value: value,
              oldValue: oldValue,
            };
            if (copyPayload(event, located, target) === Copied.Reaches) {
              const after = shallowCopy(target);
              after.delete(value);
              copyPayloadReaching(event!, located!, target, after);
            }
            const result = target.delete(value);
            const newSize = target.size;

            if (result) {
              if (watch.indexed) indexRemoved(target, value);
              if (isObject(value)) detachPlace(value, node, undefined);
              if (event !== undefined) dispatch(located!, event);
              trigger(target, Symbol.iterator);
              if (oldSize !== newSize) {
                trigger(target, "size");
              }
              if (isObject(value)) evictDeep(value);
            }
            return result;
          }
          return false;
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
          if (watch.indexed) forgetReplicaIndex(target);

          for (const member of removed) {
            if (isObject(member)) detachPlace(member, node, undefined);
          }
          const located = locate(node);
          if (located !== undefined) {
            dispatch(located, {
              action: "set-clear",
              path: located.paths[0],
              value: null,
            });
          }
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
          }
          for (const member of removed) {
            if (isObject(member)) evictDeep(member);
          }
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        track(target, Symbol.iterator);
        methodCache[prop] = function (value: T): boolean {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "symbol"
          ) {
            track(target, String(value));
          }
          return target.has(value);
        }.bind(target);
        return methodCache[prop];
      }
      if (
        prop === "values" ||
        prop === Symbol.iterator ||
        prop === "entries" ||
        prop === "keys" ||
        prop === "forEach"
      ) {
        track(target, Symbol.iterator);
        const originalMethod = Reflect.get(target, prop, receiver);

        if (prop === "forEach") {
          methodCache[prop] = (
            callbackfn: (value: T, value2: T, set: Set<T>) => void,
            thisArg?: any
          ): void => {
            const valuesIterator = proxy.values();
            for (const value of valuesIterator) {
              callbackfn.call(thisArg, value, value, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function* (...args: any[]) {
          let index = 0;
          const iterator = originalMethod.apply(target, args);

          for (const entry of iterator) {
            let valueToWrap = entry;
            if (prop === "entries") {
              valueToWrap = entry[1];
            }

            track(target, String(index));

            const wrappedValue = isObject(valueToWrap)
              ? wrapChild(valueToWrap, node, undefined)
              : valueToWrap;

            if (prop === "entries") {
              yield [wrappedValue, wrappedValue];
            } else {
              yield wrappedValue;
            }
            index++;
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
        return Set;
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });

  globalSeen.set(set, proxy);
  wrapperCache.set(set, proxy);
  proxyStats.created++;
  proxyStats.sets++;
  return proxy;
}
