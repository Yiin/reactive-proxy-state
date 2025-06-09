import { EmitFunction, Path, StateEvent } from "./types";
import {
  deepEqual,
  globalSeen,
  getPathConcat,
  setPathConcat,
  deepClone,
} from "./utils";
import { wrapArray } from "./wrap-array";
import { wrapMap } from "./wrap-map";
import { wrapSet } from "./wrap-set";
import { track, trigger } from "./watch-effect";
import { ReactiveFlags } from "./constants";

// avoid repeated typeof checks
function isObject(v: any): v is object {
  return v && typeof v === "object";
}

/**
 * Checks if an object is a reactive proxy
 */
export function isReactive(value: any): boolean {
  return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}

/**
 * Returns the raw, original object underlying a reactive proxy.
 * If the input is not a proxy, returns the input itself.
 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as any)[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
}

/**
 * Create a reactive proxy for an object
 */
export function reactive<T extends object>(
  obj: T,
  emit?: EmitFunction,
  path: Path = []
): T {
  // prevent infinite recursion with circular references
  if (globalSeen.has(obj)) return globalSeen.get(obj);

  // if this is the root call (path is empty) and an emit function is provided,
  // emit the initial state event.
  if (emit && path.length === 0) {
    try {
      const initialEvent: StateEvent = {
        action: "replace",
        path: [],
        newValue: obj,
      };
      emit(initialEvent);
    } catch (error) {
      console.error("Failed to emit initial reactive state:", error);
    }
  }

  // Delegate to specific wrappers for root collections
  if (Array.isArray(obj)) {
    return wrapArray(obj, emit, path) as T;
  }
  if (obj instanceof Map) {
    return wrapMap(obj, emit, path) as T;
  }
  if (obj instanceof Set) {
    return wrapSet(obj, emit, path) as T;
  }

  // helper to wrap nested values recursively
  function wrapValue(val: any, subPath: Path): any {
    if (!isObject(val)) return val; // primitives are returned directly
    if (globalSeen.has(val)) return globalSeen.get(val); // handle cycles within nested structures

    // delegate wrapping to specific functions based on type
    if (Array.isArray(val)) return wrapArray(val, emit, subPath);
    if (val instanceof Map) return wrapMap(val, emit, subPath);
    if (val instanceof Set) return wrapSet(val, emit, subPath);
    if (val instanceof Date) return new Date(val.getTime()); // dates are not proxied, return copy

    // default to reactive for plain objects
    return reactive(val, emit, subPath);
  }

  const proxy = new Proxy(obj, {
    get(target: T, prop: string | symbol, receiver: any): any {
      // Special handling for reactive flags
      if (prop === ReactiveFlags.RAW) {
        return target;
      }
      if (prop === ReactiveFlags.IS_REACTIVE) {
        return true;
      }

      const value = Reflect.get(target, prop, receiver);

      // track property access for dependency tracking
      track(target, prop);

      // return non-objects directly without wrapping
      if (!isObject(value)) return value;

      // calculate the path for the nested property, using cache for performance
      const propKey = String(prop);
      const pathKey =
        path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
      let newPath = getPathConcat(pathKey);

      if (newPath === undefined) {
        newPath = path.concat(propKey);
        setPathConcat(pathKey, newPath);
      }

      // wrap the nested value if it's an object/collection
      return wrapValue(value, newPath);
    },
    set(target: T, prop: string | symbol, value: any, receiver: any): boolean {
      const oldValue = (target as any)[prop];

      // avoid unnecessary triggers if the value hasn't changed
      // fast path for primitives
      if (oldValue === value) return true;
      // deep equality check for objects/arrays
      if (
        isObject(oldValue) &&
        isObject(value) &&
        deepEqual(oldValue, value, new WeakMap())
      )
        return true; // use new WeakMap for deepEqual seen

      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const result = Reflect.set(target, prop, value, receiver);

      // only emit and trigger if the set was successful and wasn't intercepted by a setter
      if (result && (!descriptor || !descriptor.set)) {
        // calculate path, using cache
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
          newValue: value,
        };

        emit?.(event);

        // notify effects watching this property
        trigger(target, prop);
      }
      return result;
    },
    deleteProperty(target: T, prop: string | symbol): boolean {
      const oldValue = (target as any)[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const result = Reflect.deleteProperty(target, prop);

      // only emit and trigger if the property existed and deletion was successful
      if (hadProperty && result) {
        // calculate path, using cache
        const propKey = String(prop);
        const pathKey =
          path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);

        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }

        const event: StateEvent = {
          action: "delete",
          path: newPath,
          oldValue,
        };

        emit?.(event);

        // notify effects watching this property
        trigger(target, prop);
      }

      return result;
    },
  });

  // cache the proxy to handle circular references and improve performance
  globalSeen.set(obj, proxy);
  return proxy;
}
