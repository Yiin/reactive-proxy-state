import { deepEqual, getPathConcat, setPathConcat, wrapperCache } from './utils';
import { reactive } from './reactive';
import { wrapMap } from './wrapMap';
import { wrapSet } from './wrapSet';
import { track, trigger } from './watchEffect';
// avoid repeated typeof checks
function isObject(v) {
    return v && typeof v === 'object';
}
export function wrapArray(arr, emit, path) {
    // reuse existing proxy if available for performance
    const cachedProxy = wrapperCache.get(arr);
    if (cachedProxy)
        return cachedProxy;
    const proxy = new Proxy(arr, {
        get(target, prop, receiver) {
            track(target, prop);
            // handle specific array mutation methods that require custom logic and event emission
            switch (prop) {
                case 'push':
                    track(target, 'length');
                    return function (...items) {
                        const oldLength = target.length;
                        const result = target.push(...items);
                        const newLength = target.length;
                        if (items.length > 0) {
                            const event = {
                                action: 'array-push',
                                path: path,
                                key: oldLength, // start index was the old length
                                items: items
                            };
                            emit(event);
                            trigger(target, Symbol.iterator);
                            if (oldLength !== newLength) {
                                trigger(target, 'length');
                            }
                        }
                        return result;
                    };
                case 'pop':
                    track(target, 'length');
                    return function () {
                        if (target.length === 0)
                            return undefined;
                        const oldLength = target.length;
                        const poppedIndex = oldLength - 1;
                        const oldValue = target[poppedIndex];
                        const result = target.pop();
                        const newLength = target.length;
                        const event = {
                            action: 'array-pop',
                            path: path,
                            key: poppedIndex,
                            oldValue: oldValue
                        };
                        emit(event);
                        trigger(target, Symbol.iterator);
                        if (oldLength !== newLength) {
                            trigger(target, 'length');
                        }
                        return result;
                    };
                case 'shift':
                    track(target, 'length');
                    return function () {
                        if (target.length === 0)
                            return undefined;
                        const oldLength = target.length;
                        const oldValue = target[0];
                        const result = target.shift();
                        const newLength = target.length;
                        const event = {
                            action: 'array-shift',
                            path: path,
                            key: 0,
                            oldValue: oldValue
                        };
                        emit(event);
                        trigger(target, Symbol.iterator);
                        if (oldLength !== newLength) {
                            trigger(target, 'length');
                        }
                        return result;
                    };
                case 'unshift':
                    track(target, 'length');
                    return function (...items) {
                        const oldLength = target.length;
                        const result = target.unshift(...items);
                        const newLength = target.length;
                        if (items.length > 0) {
                            const event = {
                                action: 'array-unshift',
                                path: path,
                                key: 0,
                                items: items
                            };
                            emit(event);
                            trigger(target, Symbol.iterator);
                            if (oldLength !== newLength) {
                                trigger(target, 'length');
                            }
                        }
                        return result;
                    };
                case 'splice':
                    track(target, 'length');
                    return function (start, deleteCount, ...items) {
                        const oldLength = target.length;
                        const actualStart = start < 0 ? Math.max(target.length + start, 0) : Math.min(start, target.length);
                        const deleteCountNum = deleteCount === undefined ? target.length - actualStart : Number(deleteCount);
                        const actualDeleteCount = Math.min(deleteCountNum, target.length - actualStart);
                        const deletedItems = target.slice(actualStart, actualStart + actualDeleteCount);
                        const result = target.splice(start, deleteCountNum, ...items);
                        const newLength = target.length;
                        if (actualDeleteCount > 0 || items.length > 0) {
                            const event = {
                                action: 'array-splice',
                                path: path,
                                key: actualStart,
                                deleteCount: actualDeleteCount,
                                items: items.length > 0 ? items : undefined,
                                oldValues: deletedItems.length > 0 ? deletedItems : undefined
                            };
                            emit(event);
                            trigger(target, Symbol.iterator);
                            if (oldLength !== newLength) {
                                trigger(target, 'length');
                            }
                        }
                        return result;
                    };
                // handle methods that rely on iteration state
                case Symbol.iterator:
                case 'values':
                case 'keys':
                case 'entries':
                case 'forEach':
                case 'map':
                case 'filter':
                case 'reduce':
                case 'reduceRight':
                case 'find':
                case 'findIndex':
                case 'every':
                case 'some':
                case 'join':
                    track(target, Symbol.iterator);
                    // fall through to default behavior (usually binding)
                    break;
                case 'length':
                    track(target, 'length');
                    return Reflect.get(target, prop, receiver);
            }
            const value = Reflect.get(target, prop, receiver);
            // determine if the property access is numeric array index access
            const isNumericIndex = typeof prop === 'number' || (typeof prop === 'string' && !isNaN(parseInt(prop, 10)));
            if (isNumericIndex) {
                track(target, String(prop));
                if (!isObject(value))
                    return value;
                // reuse existing proxy for nested object/array if available
                const cachedValueProxy = wrapperCache.get(value);
                if (cachedValueProxy)
                    return cachedValueProxy;
                // calculate the nested path for the element, optimizing with caching
                const propKey = String(prop);
                const pathKey = path.length > 0 ? `${path.join('.')}.${propKey}` : propKey;
                let newPath = getPathConcat(pathKey);
                if (newPath === undefined) {
                    newPath = path.concat(propKey);
                    setPathConcat(pathKey, newPath);
                }
                // recursively wrap nested structures
                if (Array.isArray(value))
                    return wrapArray(value, emit, newPath);
                if (value instanceof Map)
                    return wrapMap(value, emit, newPath);
                if (value instanceof Set)
                    return wrapSet(value, emit, newPath);
                if (value instanceof Date)
                    return new Date(value.getTime()); // dates are not proxied, return a copy
                return reactive(value, emit, newPath);
            }
            // ensure functions accessed directly are bound to the original target
            if (typeof value === 'function') {
                return value.bind(target);
            }
            return value;
        },
        set(target, prop, value, receiver) {
            const oldValue = target[prop];
            // avoid unnecessary triggers if value hasn't changed
            if (oldValue === value)
                return true;
            if (isObject(oldValue) && isObject(value) && deepEqual(oldValue, value, new WeakMap()))
                return true;
            const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            const result = Reflect.set(target, prop, value, receiver);
            const isNumericIndex = typeof prop === 'number' || (typeof prop === 'string' && !isNaN(parseInt(String(prop))));
            // emit event and trigger effects only if the set was successful and wasn't intercepted by a setter
            // (unless it's a direct numeric index set, which doesn't have a descriptor.set)
            if (result && (!descriptor || !descriptor.set || isNumericIndex)) {
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
                trigger(target, prop);
            }
            return result;
        }
    });
    // cache the newly created proxy before returning
    wrapperCache.set(arr, proxy);
    return proxy;
}
