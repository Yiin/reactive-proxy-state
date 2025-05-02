import { EmitFunction, Path, StateEvent } from './types';
import { deepEqual, getPathConcat, setPathConcat, wrapperCache, globalSeen } from './utils';
import { reactive } from './reactive';
import { wrapArray } from './wrap-array';
import { wrapSet } from './wrap-set';
import { track, trigger } from './watch-effect';

export function wrapMap<K, V>(map: Map<K, V>, emit?: EmitFunction, path: Path = [], seen: WeakMap<any, any> = globalSeen): Map<K, V> {
    const cachedProxy = wrapperCache.get(map);
    if (cachedProxy) return cachedProxy as Map<K, V>;
    if (seen.has(map)) return seen.get(map);

    const methodCache: { [key: string | symbol]: Function } = {};

    const proxy = new Proxy(map, {
        get(target: Map<K, V>, prop: string | symbol, receiver: any): any {
            track(target, prop);

            if (prop === Symbol.iterator || prop === 'entries' || prop === 'values' || prop === 'keys' || prop === 'forEach') {
                track(target, Symbol.iterator);
            }

            if (methodCache[prop]) {
                return methodCache[prop];
            }

            if (prop === 'set') {
                methodCache[prop] = function (key: K, value: V): Map<K, V> {
                    const existed = target.has(key);
                    const oldValue = target.get(key);
                    const oldSize = target.size;

                    if (oldValue === value) return receiver;
                    if (oldValue && typeof oldValue === 'object' && value && typeof value === 'object' && deepEqual(oldValue, value, new WeakMap())) return receiver;

                    target.set(key, value);
                    const newSize = target.size;

                    const pathKey = path.join('.');
                    let cachedPath = getPathConcat(pathKey);
                    if (cachedPath === undefined) {
                        cachedPath = path;
                        setPathConcat(pathKey, cachedPath);
                    }

                    const event: StateEvent = {
                        action: 'map-set',
                        path: cachedPath,
                        key,
                        oldValue,
                        newValue: value
                    };
                    emit?.(event);

                    if (!existed) {
                        trigger(target, Symbol.iterator);
                        if (oldSize !== newSize) {
                            trigger(target, 'size');
                        }
                    } else {
                        trigger(target, String(key));
                    }

                    return receiver;
                };
                return methodCache[prop];
            }
            if (prop === 'delete') {
                methodCache[prop] = function (key: K): boolean {
                    const existed = target.has(key);
                    if (!existed) return false;

                    const oldValue = target.get(key);
                    const oldSize = target.size;

                    const result = target.delete(key);
                    const newSize = target.size;

                    if (result) {
                        const pathKey = path.join('.');
                        let cachedPath = getPathConcat(pathKey);
                        if (cachedPath === undefined) {
                            cachedPath = path;
                            setPathConcat(pathKey, cachedPath);
                        }

                        const event: StateEvent = {
                            action: 'map-delete',
                            path: cachedPath,
                            key,
                            oldValue
                        };
                        emit?.(event);

                        trigger(target, Symbol.iterator);
                        if (oldSize !== newSize) {
                            trigger(target, 'size');
                        }
                        trigger(target, String(key));
                    }

                    return result;
                };
                return methodCache[prop];
            }
            if (prop === 'clear') {
                methodCache[prop] = function (): void {
                    const oldSize = target.size;
                    if (oldSize === 0) return;

                    target.clear();
                    const newSize = target.size;

                    const event: StateEvent = {
                        action: 'map-clear',
                        path: path,
                        key: null
                    };
                    emit?.(event);

                    trigger(target, Symbol.iterator);
                    if (oldSize !== newSize) {
                        trigger(target, 'size');
                    }
                };
                return methodCache[prop];
            }
            if (prop === 'get') {
                methodCache[prop] = function (key: K): any {
                    track(target, String(key));
                    const value = target.get(key);

                    if (!value || typeof value !== 'object') return value;
                    if (seen.has(value)) return seen.get(value);

                    const cachedValueProxy = wrapperCache.get(value);
                    if (cachedValueProxy) return cachedValueProxy;

                    const keyString = String(key);
                    const pathKey = path.length > 0 ? `${path.join('.')}.${keyString}` : keyString;
                    let newPath = getPathConcat(pathKey);

                    if (newPath === undefined) {
                        newPath = path.concat(keyString);
                        setPathConcat(pathKey, newPath);
                    }

                    if (value instanceof Map) return wrapMap(value, emit, newPath, seen);
                    if (value instanceof Set) return wrapSet(value, emit, newPath, seen);
                    if (Array.isArray(value)) return wrapArray(value, emit, newPath, seen);
                    if (value instanceof Date) return new Date(value.getTime());
                    return reactive(value, emit, newPath, seen);
                };
                return methodCache[prop];
            }
            if (prop === 'has') {
                track(target, Symbol.iterator);
                methodCache[prop] = function (key: K): boolean {
                    track(target, String(key));
                    return target.has(key);
                }.bind(target);
                return methodCache[prop];
            }

            if (prop === Symbol.iterator || prop === 'entries' || prop === 'values' || prop === 'keys' || prop === 'forEach') {
                track(target, Symbol.iterator);
                const originalMethod = Reflect.get(target, prop, receiver);

                if (prop === 'forEach') {
                    methodCache[prop] = (callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void => {
                        const entriesIterator = proxy.entries();
                        for (const [key, value] of entriesIterator) {
                            callbackfn.call(thisArg, value, key, proxy);
                        }
                    }
                    return methodCache[prop];
                }

                methodCache[prop] = function* (...args: any[]) {
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

                        let wrappedKey = keyToWrap;
                        if (isEntry && keyToWrap && typeof keyToWrap === 'object') {
                            if (seen.has(keyToWrap)) {
                                wrappedKey = seen.get(keyToWrap);
                            } else {
                                const pathKey = path.length > 0 ? `${path.join('.')}.${String(keyToWrap)}` : String(keyToWrap);
                                let keyPath = getPathConcat(pathKey);
                                if (keyPath === undefined) {
                                    keyPath = path.concat(String(keyToWrap));
                                    setPathConcat(pathKey, keyPath);
                                }
                                wrappedKey = reactive(keyToWrap, emit, keyPath, seen);
                            }
                        }

                        let wrappedValue = valueToWrap;
                        if (valueToWrap && typeof valueToWrap === 'object') {
                            if (seen.has(valueToWrap)) {
                                wrappedValue = seen.get(valueToWrap);
                            } else {
                                const cachedValueProxy = wrapperCache.get(valueToWrap);
                                if (cachedValueProxy) {
                                    wrappedValue = cachedValueProxy;
                                } else {
                                    const keyString = String(keyToWrap);
                                    const pathKey = path.length > 0 ? `${path.join('.')}.${keyString}` : keyString;
                                    let newPath = getPathConcat(pathKey);
                                    if (newPath === undefined) {
                                        newPath = path.concat(keyString);
                                        setPathConcat(pathKey, newPath);
                                    }
                                    if (valueToWrap instanceof Map) wrappedValue = wrapMap(valueToWrap, emit, newPath, seen);
                                    else if (valueToWrap instanceof Set) wrappedValue = wrapSet(valueToWrap, emit, newPath, seen);
                                    else if (Array.isArray(valueToWrap)) wrappedValue = wrapArray(valueToWrap, emit, newPath, seen);
                                    else if (valueToWrap instanceof Date) wrappedValue = new Date(valueToWrap.getTime());
                                    else wrappedValue = reactive(valueToWrap, emit, newPath, seen);
                                }
                            }
                        }

                        if (prop === 'entries' || prop === Symbol.iterator) {
                            yield [wrappedKey, wrappedValue];
                        } else if (prop === 'values') {
                            yield wrappedValue;
                        } else {
                            yield wrappedKey;
                        }
                    }
                };
                return methodCache[prop];
            }

            if (prop === 'size') {
                track(target, 'size');
                return target.size;
            }

            const value = Reflect.get(target, prop, receiver);
            if (typeof value === 'function') {
                return value.bind(target);
            }
            return value;
        }
    });

    seen.set(map, proxy);
    wrapperCache.set(map, proxy);
    return proxy;
}
