import { EmitFunction, Path, StateEvent } from "./types";
import {
  getPathConcat,
  setPathConcat,
  wrapperCache,
  globalSeen,
} from "./utils";
import { reactive } from "./reactive";
import { wrapArray } from "./wrap-array";
import { wrapMap } from "./wrap-map";
import { track, trigger } from "./watch-effect";

export function wrapSet<T>(
  set: Set<T>,
  emit?: EmitFunction,
  path: Path = []
): Set<T> {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy) return cachedProxy as Set<T>;
  if (globalSeen.has(set)) return globalSeen.get(set);

  const methodCache: { [key: string | symbol]: Function } = {};

  const proxy = new Proxy(set, {
    get(target: Set<T>, prop: string | symbol, receiver: any): any {
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
          const existed = target.has(value);
          const oldSize = target.size;

          if (!existed) {
            target.add(value);
            const newSize = target.size;

            const event: StateEvent = {
              action: "set-add",
              path: path,
              value: value,
            };
            emit?.(event);
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
            const result = target.delete(value);
            const newSize = target.size;

            if (result) {
              const event: StateEvent = {
                action: "set-delete",
                path: path,
                value: value,
                oldValue: oldValue,
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldSize !== newSize) {
                trigger(target, "size");
              }
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

          target.clear();
          const newSize = target.size;

          const event: StateEvent = {
            action: "set-clear",
            path: path,
            value: null,
          };
          emit?.(event);
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
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

            let wrappedValue = valueToWrap;
            if (valueToWrap && typeof valueToWrap === "object") {
              if (globalSeen.has(valueToWrap)) {
                wrappedValue = globalSeen.get(valueToWrap);
              } else {
                const cachedValueProxy = wrapperCache.get(valueToWrap);
                if (cachedValueProxy) {
                  wrappedValue = cachedValueProxy;
                } else {
                  const keyForPath = String(index);
                  const pathKey =
                    path.length > 0
                      ? `${path.join(".")}.${keyForPath}`
                      : keyForPath;
                  let newPath = getPathConcat(pathKey);
                  if (newPath === undefined) {
                    newPath = path.concat(keyForPath);
                    setPathConcat(pathKey, newPath);
                  }

                  if (valueToWrap instanceof Map)
                    wrappedValue = wrapMap(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Set)
                    wrappedValue = wrapSet(valueToWrap, emit, newPath);
                  else if (Array.isArray(valueToWrap))
                    wrappedValue = wrapArray(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Date)
                    wrappedValue = new Date(valueToWrap.getTime());
                  else wrappedValue = reactive(valueToWrap, emit, newPath);
                }
              }
            }

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

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });

  globalSeen.set(set, proxy);
  wrapperCache.set(set, proxy);
  return proxy;
}
