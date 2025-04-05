import { deepEqual, globalSeen, getPathConcat, setPathConcat } from './utils';
import { wrapArray } from './wrapArray';
import { wrapMap } from './wrapMap';
import { wrapSet } from './wrapSet';
import { track, trigger } from './watchEffect';
// Pre-allocate type check function
function isObject(v) {
    return v && typeof v === 'object';
}
export function reactive(obj, emit, path = [], seen = globalSeen) {
    if (seen.has(obj))
        return seen.get(obj);
    function wrapValue(val, subPath) {
        if (!isObject(val))
            return val;
        if (seen.has(val))
            return seen.get(val);
        if (Array.isArray(val))
            return wrapArray(val, emit, subPath);
        if (val instanceof Map)
            return wrapMap(val, emit, subPath);
        if (val instanceof Set)
            return wrapSet(val, emit, subPath);
        if (val instanceof Date)
            return new Date(val.getTime());
        return reactive(val, emit, subPath, seen);
    }
    const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            // Track this property access for reactivity
            track(target, prop);
            // Fast path for non-objects
            if (!isObject(value))
                return value;
            // Use cached path concatenation
            const pathKey = `${path.join('.')}.${String(prop)}`;
            let newPath = getPathConcat(pathKey);
            if (newPath === undefined) {
                newPath = path.concat(String(prop));
                setPathConcat(pathKey, newPath);
            }
            return wrapValue(value, newPath);
        },
        set(target, prop, value, receiver) {
            const oldValue = target[prop];
            // Fast path for primitive equality
            if (oldValue === value)
                return true;
            // Only do deep equality check for objects
            if (isObject(oldValue) && isObject(value) && deepEqual(oldValue, value))
                return true;
            const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            const result = Reflect.set(target, prop, value, receiver);
            // Only emit if the set was successful and it's not a setter property
            if (result && (!descriptor || !descriptor.set)) {
                // Use cached path concatenation
                const pathKey = `${path.join('.')}.${String(prop)}`;
                let newPath = getPathConcat(pathKey);
                if (newPath === undefined) {
                    newPath = path.concat(String(prop));
                    setPathConcat(pathKey, newPath);
                }
                const event = {
                    action: 'set',
                    path: newPath,
                    oldValue,
                    newValue: value
                };
                emit(event);
                // Trigger effects
                trigger(target, prop);
            }
            return result;
        },
        deleteProperty(target, prop) {
            const oldValue = target[prop];
            const result = Reflect.deleteProperty(target, prop);
            // Use cached path concatenation
            const pathKey = `${path.join('.')}.${String(prop)}`;
            let newPath = getPathConcat(pathKey);
            if (newPath === undefined) {
                newPath = path.concat(String(prop));
                setPathConcat(pathKey, newPath);
            }
            const event = {
                action: 'delete',
                path: newPath,
                oldValue
            };
            emit(event);
            // Trigger effects
            trigger(target, prop);
            return result;
        }
    });
    seen.set(obj, proxy);
    return proxy;
}
