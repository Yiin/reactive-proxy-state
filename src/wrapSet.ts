import { EmitFunction, Path, StateEvent } from './types';
import { getPathConcat, setPathConcat, wrapperCache } from './utils';
import { reactive } from './reactive';
import { wrapArray } from './wrapArray';
import { wrapMap } from './wrapMap';
import { track, trigger } from './watchEffect';

export function wrapSet<T>(set: Set<T>, emit: EmitFunction, path: Path): Set<T> {
    // reuse existing proxy if available for performance
    const cachedProxy = wrapperCache.get(set);
    if (cachedProxy) return cachedProxy as Set<T>;

    const proxy = new Proxy(set, {
        get(target: Set<T>, prop: string | symbol, receiver: any): any {
            track(target, prop);

            if (prop === 'add') {
                return function (value: T): Set<T> {
                    const existed = target.has(value);
                    const oldSize = target.size;

                    // only add and trigger if the value doesn't already exist
                    if (!existed) {
                        target.add(value);
                        const newSize = target.size;

                        const event: StateEvent = {
                            action: 'set-add',
                            path: path,
                            value: value
                        };
                        emit(event);
                        trigger(target, Symbol.iterator);
                        if (oldSize !== newSize) {
                           trigger(target, 'size');
                        }
                    }
                    return receiver; // return the proxy itself for chaining
                };
            }
            if (prop === 'delete') {
                return function (value: T): boolean {
                    const existed = target.has(value);
                    const oldSize = target.size;

                    if (existed) {
                        const oldValue = value;
                        const result = target.delete(value);
                        const newSize = target.size;

                        if (result) { // only emit and trigger if delete was successful
                           const event: StateEvent = {
                                action: 'set-delete',
                                path: path,
                                value: value,
                                oldValue: oldValue
                            };
                            emit(event);
                            trigger(target, Symbol.iterator);
                            if (oldSize !== newSize) {
                                trigger(target, 'size');
                            }
                        }
                        return result;
                    }
                    return false;
                };
            }
            if (prop === 'clear') {
                return function (): void {
                    const oldSize = target.size;
                    if (oldSize === 0) return;

                    target.clear();
                    const newSize = target.size;

                    const event: StateEvent = {
                        action: 'set-clear',
                        path: path,
                        value: null
                    };
                    emit(event);
                    trigger(target, Symbol.iterator);
                    if (oldSize !== newSize) {
                        trigger(target, 'size');
                    }
                };
            }
            if (prop === 'has') {
                track(target, Symbol.iterator);
                return function(value: T): boolean {
                    // track specific primitive value when 'has' is called
                    // tracking object values for existence is complex and less common, handled by iteration track
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol') {
                        track(target, String(value));
                    }
                    return target.has(value);
                }.bind(target);
            }
            // handle iteration methods
            if (prop === 'values' || prop === Symbol.iterator || prop === 'entries' || prop === 'keys' || prop === 'forEach') {
                track(target, Symbol.iterator);
                const originalMethod = Reflect.get(target, prop, receiver);

                // return custom iterators/foreach that wrap values during iteration
                if (prop === 'forEach') {
                    return (callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void => {
                        // use the proxied values() to ensure values passed to callback are wrapped and tracked
                         const valuesIterator = proxy.values();
                         for (const value of valuesIterator) {
                             callbackfn.call(thisArg, value, value, proxy);
                         }
                    }
                }
                 // handle symbol.iterator, values, keys, entries by creating generator functions
                 return function* (...args: any[]) {
                    let index = 0; // use index for path generation if value is not primitive
                    const iterator = originalMethod.apply(target, args);

                    for (const entry of iterator) {
                        let valueToWrap = entry;
                        let mapKey = undefined; // key for entries() which yields [value, value]

                        if (prop === 'entries') {
                            mapKey = entry[0]; // for Set.entries(), key and value are the same
                            valueToWrap = entry[1];
                        }

                        track(target, String(index));

                        let wrappedValue = valueToWrap;
                        if (valueToWrap && typeof valueToWrap === 'object') {
                             const cachedValueProxy = wrapperCache.get(valueToWrap);
                             if (cachedValueProxy) {
                                 wrappedValue = cachedValueProxy;
                             } else {
                                 // calculate path using index as key, as set values don't have inherent keys
                                 const keyForPath = String(index);
                                 const pathKey = path.length > 0 ? `${path.join('.')}.${keyForPath}` : keyForPath;
                                 let newPath = getPathConcat(pathKey);
                                 if (newPath === undefined) {
                                     newPath = path.concat(keyForPath);
                                     setPathConcat(pathKey, newPath);
                                 }

                                 // recursively wrap nested structures
                                 if (valueToWrap instanceof Map) wrappedValue = wrapMap(valueToWrap, emit, newPath);
                                 else if (valueToWrap instanceof Set) wrappedValue = wrapSet(valueToWrap, emit, newPath);
                                 else if (Array.isArray(valueToWrap)) wrappedValue = wrapArray(valueToWrap, emit, newPath);
                                 else if (valueToWrap instanceof Date) wrappedValue = new Date(valueToWrap.getTime()); // dates are not proxied, return copy
                                 else wrappedValue = reactive(valueToWrap, emit, newPath);
                             }
                        }

                        if (prop === 'entries') {
                            yield [wrappedValue, wrappedValue]; // set entries yield [value, value]
                        } else {
                            yield wrappedValue;
                        }
                        index++;
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
    wrapperCache.set(set, proxy);
    return proxy;
} 