import { deepEqual, getPathConcat, setPathConcat, wrapperCache } from './utils';
import { reactive } from './reactive';
import { wrapArray } from './wrapArray';
import { wrapSet } from './wrapSet';
import { track, trigger } from './watchEffect';
export function wrapMap(map, emit, path) {
    // reuse existing proxy if available for performance
    const cachedProxy = wrapperCache.get(map);
    if (cachedProxy)
        return cachedProxy;
    const proxy = new Proxy(map, {
        get(target, prop, receiver) {
            track(target, prop);
            if (prop === 'set') {
                return function (key, value) {
                    const existed = target.has(key);
                    const oldValue = target.get(key);
                    const oldSize = target.size;
                    // avoid unnecessary work if value hasn't changed
                    if (oldValue === value)
                        return receiver;
                    if (oldValue && typeof oldValue === 'object' && value && typeof value === 'object' && deepEqual(oldValue, value, new WeakMap()))
                        return receiver;
                    target.set(key, value);
                    const newSize = target.size;
                    // optimize path calculation by caching concatenated paths
                    const pathKey = path.join('.');
                    let cachedPath = getPathConcat(pathKey);
                    if (cachedPath === undefined) {
                        cachedPath = path;
                        setPathConcat(pathKey, cachedPath);
                    }
                    const event = {
                        action: 'map-set',
                        path: cachedPath,
                        key,
                        oldValue,
                        newValue: value
                    };
                    emit(event);
                    // trigger effects based on whether it was an add or update
                    if (!existed) {
                        trigger(target, Symbol.iterator);
                        if (oldSize !== newSize) {
                            trigger(target, 'size');
                        }
                    }
                    else {
                        trigger(target, String(key));
                    }
                    return receiver;
                };
            }
            if (prop === 'delete') {
                return function (key) {
                    const existed = target.has(key);
                    if (!existed)
                        return false;
                    const oldValue = target.get(key);
                    const oldSize = target.size;
                    const result = target.delete(key);
                    const newSize = target.size;
                    if (result) { // only emit and trigger if delete was successful
                        const pathKey = path.join('.');
                        let cachedPath = getPathConcat(pathKey);
                        if (cachedPath === undefined) {
                            cachedPath = path;
                            setPathConcat(pathKey, cachedPath);
                        }
                        const event = {
                            action: 'map-delete',
                            path: cachedPath,
                            key,
                            oldValue
                        };
                        emit(event);
                        trigger(target, Symbol.iterator);
                        if (oldSize !== newSize) {
                            trigger(target, 'size');
                        }
                    }
                    return result;
                };
            }
            if (prop === 'clear') {
                return function () {
                    const oldSize = target.size;
                    if (oldSize === 0)
                        return;
                    target.clear();
                    const newSize = target.size;
                    const event = {
                        action: 'map-clear',
                        path: path,
                        key: null
                    };
                    emit(event);
                    trigger(target, Symbol.iterator);
                    if (oldSize !== newSize) {
                        trigger(target, 'size');
                    }
                };
            }
            if (prop === 'get') {
                // return a function that tracks the specific key only when called
                return function (key) {
                    track(target, String(key));
                    const value = target.get(key);
                    if (!value || typeof value !== 'object')
                        return value;
                    const cachedValueProxy = wrapperCache.get(value);
                    if (cachedValueProxy)
                        return cachedValueProxy;
                    const keyString = String(key);
                    const pathKey = path.length > 0 ? `${path.join('.')}.${keyString}` : keyString;
                    let newPath = getPathConcat(pathKey);
                    if (newPath === undefined) {
                        newPath = path.concat(keyString);
                        setPathConcat(pathKey, newPath);
                    }
                    // recursively wrap nested structures
                    if (value instanceof Map)
                        return wrapMap(value, emit, newPath);
                    if (value instanceof Set)
                        return wrapSet(value, emit, newPath);
                    if (Array.isArray(value))
                        return wrapArray(value, emit, newPath);
                    if (value instanceof Date)
                        return new Date(value.getTime()); // dates are not proxied, return a copy
                    return reactive(value, emit, newPath);
                };
            }
            if (prop === 'has') {
                track(target, Symbol.iterator);
                return function (key) {
                    // track the specific key only when 'has' is called
                    track(target, String(key));
                    return target.has(key);
                }.bind(target);
            }
            // handle iteration methods
            if (prop === Symbol.iterator || prop === 'entries' || prop === 'values' || prop === 'keys' || prop === 'forEach') {
                track(target, Symbol.iterator);
                const originalMethod = Reflect.get(target, prop, receiver);
                // return custom iterators/foreach that wrap values during iteration
                if (prop === 'forEach') {
                    return (callbackfn, thisArg) => {
                        // use the proxied .entries() to ensure values passed to callback are wrapped and tracked
                        const entriesIterator = proxy.entries();
                        for (const [key, value] of entriesIterator) {
                            callbackfn.call(thisArg, value, key, proxy);
                        }
                    };
                }
                // handle symbol.iterator, entries, values, keys by creating generator functions
                return function* (...args) {
                    const iterator = originalMethod.apply(target, args);
                    for (const entry of iterator) {
                        let keyToWrap = entry;
                        let valueToWrap = entry;
                        let isEntry = false;
                        if (prop === 'entries' || prop === Symbol.iterator) {
                            keyToWrap = entry[0];
                            valueToWrap = entry[1];
                            isEntry = true;
                        }
                        // wrap key if it's an object
                        // note: reactivity on map keys can be complex/unexpected
                        let wrappedKey = keyToWrap;
                        if (isEntry && keyToWrap && typeof keyToWrap === 'object') {
                            const pathKey = path.length > 0 ? `${path.join('.')}.${String(keyToWrap)}` : String(keyToWrap);
                            let keyPath = getPathConcat(pathKey);
                            if (keyPath === undefined) {
                                keyPath = path.concat(String(keyToWrap));
                                setPathConcat(pathKey, keyPath);
                            }
                            // todo: decide if map keys should be deeply reactive
                            wrappedKey = reactive(keyToWrap, emit, keyPath);
                        }
                        // wrap value if it's an object
                        let wrappedValue = valueToWrap;
                        if (valueToWrap && typeof valueToWrap === 'object') {
                            const cachedValueProxy = wrapperCache.get(valueToWrap);
                            if (cachedValueProxy) {
                                wrappedValue = cachedValueProxy;
                            }
                            else {
                                const keyString = String(keyToWrap); // use original key for path
                                const pathKey = path.length > 0 ? `${path.join('.')}.${keyString}` : keyString;
                                let newPath = getPathConcat(pathKey);
                                if (newPath === undefined) {
                                    newPath = path.concat(keyString);
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
                                else
                                    wrappedValue = reactive(valueToWrap, emit, newPath);
                            }
                        }
                        if (prop === 'entries' || prop === Symbol.iterator) {
                            yield [wrappedKey, wrappedValue];
                        }
                        else if (prop === 'values') {
                            yield wrappedValue;
                        }
                        else { // keys
                            yield wrappedKey;
                        }
                    }
                };
            }
            if (prop === 'size') {
                track(target, 'size');
                return target.size;
            }
            const value = Reflect.get(target, prop, receiver);
            return value;
        }
    });
    // cache the newly created proxy before returning
    wrapperCache.set(map, proxy);
    return proxy;
}
