import { deepEqual, globalSeen, getPathConcat, setPathConcat } from './utils';
import { wrapArray } from './wrap-array';
import { wrapMap } from './wrap-map';
import { wrapSet } from './wrap-set';
import { track, trigger } from './watch-effect';
// avoid repeated typeof checks
function isObject(v) {
    return v && typeof v === 'object';
}
// create a reactive proxy for an object
export function reactive(obj, emit, path = [], seen = globalSeen) {
    // prevent infinite recursion with circular references
    if (seen.has(obj))
        return seen.get(obj);
    // helper to wrap nested values recursively
    function wrapValue(val, subPath) {
        if (!isObject(val))
            return val; // primitives are returned directly
        if (seen.has(val))
            return seen.get(val); // handle cycles within nested structures
        // delegate wrapping to specific functions based on type
        if (Array.isArray(val))
            return wrapArray(val, emit, subPath);
        if (val instanceof Map)
            return wrapMap(val, emit, subPath);
        if (val instanceof Set)
            return wrapSet(val, emit, subPath);
        if (val instanceof Date)
            return new Date(val.getTime()); // dates are not proxied, return copy
        // default to reactive for plain objects
        return reactive(val, emit, subPath, seen);
    }
    const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            // track property access for dependency tracking
            track(target, prop);
            // return non-objects directly without wrapping
            if (!isObject(value))
                return value;
            // calculate the path for the nested property, using cache for performance
            const propKey = String(prop);
            const pathKey = path.length > 0 ? `${path.join('.')}.${propKey}` : propKey;
            let newPath = getPathConcat(pathKey);
            if (newPath === undefined) {
                newPath = path.concat(propKey);
                setPathConcat(pathKey, newPath);
            }
            // wrap the nested value if it's an object/collection
            return wrapValue(value, newPath);
        },
        set(target, prop, value, receiver) {
            const oldValue = target[prop];
            // avoid unnecessary triggers if the value hasn't changed
            // fast path for primitives
            if (oldValue === value)
                return true;
            // deep equality check for objects/arrays
            if (isObject(oldValue) && isObject(value) && deepEqual(oldValue, value, new WeakMap()))
                return true; // use new WeakMap for deepEqual seen
            const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            const result = Reflect.set(target, prop, value, receiver);
            // only emit and trigger if the set was successful and wasn't intercepted by a setter
            if (result && (!descriptor || !descriptor.set)) {
                // calculate path, using cache
                const propKey = String(prop);
                const pathKey = path.length > 0 ? `${path.join('.')}.${propKey}` : propKey;
                let newPath = getPathConcat(pathKey);
                if (newPath === undefined) {
                    newPath = path.concat(propKey);
                    setPathConcat(pathKey, newPath);
                }
                const event = {
                    action: 'set',
                    path: newPath,
                    oldValue,
                    newValue: value
                };
                emit(event);
                // notify effects watching this property
                trigger(target, prop);
            }
            return result;
        },
        deleteProperty(target, prop) {
            const oldValue = target[prop];
            const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
            const result = Reflect.deleteProperty(target, prop);
            // only emit and trigger if the property existed and deletion was successful
            if (hadProperty && result) {
                // calculate path, using cache
                const propKey = String(prop);
                const pathKey = path.length > 0 ? `${path.join('.')}.${propKey}` : propKey;
                let newPath = getPathConcat(pathKey);
                if (newPath === undefined) {
                    newPath = path.concat(propKey);
                    setPathConcat(pathKey, newPath);
                }
                const event = {
                    action: 'delete',
                    path: newPath,
                    oldValue
                };
                emit(event);
                // notify effects watching this property
                trigger(target, prop);
            }
            return result;
        }
    });
    // cache the proxy to handle circular references and improve performance
    seen.set(obj, proxy);
    return proxy;
}
