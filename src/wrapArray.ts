import { EmitFunction, Path, StateEvent } from './types';
import { deepEqual, globalSeen, getPathConcat, setPathConcat, wrapperCache } from './utils';
import { wrapState } from './wrapState';
import { wrapMap } from './wrapMap';
import { wrapSet } from './wrapSet';
import { track, trigger } from './watchEffect';

// Pre-allocate type check function
function isObject(v: any): v is object {
    return v && typeof v === 'object';
}

export function wrapArray<T extends any[]>(arr: T, emit: EmitFunction, path: Path): T {
    // Check wrapper cache first
    const cachedProxy = wrapperCache.get(arr);
    if (cachedProxy) return cachedProxy as T;

    const proxy = new Proxy(arr, {
        get(target: T, prop: string | symbol, receiver: any): any {
            // Original track call - might be redundant if handled below but keep for now
            track(target, prop);
            
            // Handle specific array mutation methods first
            switch (prop) {
                case 'push':
                    track(target, 'length'); 
                    return function(...items: any[]): number {
                        const oldLength = target.length;
                        const result = target.push(...items);
                        const newLength = target.length;
                        if (items.length > 0) {
                            const event: StateEvent = {
                                action: 'array-push',
                                path: path,
                                key: oldLength, // Start index was the old length
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
                    return function(): any {
                        if (target.length === 0) return undefined;
                        const oldLength = target.length;
                        const poppedIndex = oldLength - 1;
                        const oldValue = target[poppedIndex];
                        const result = target.pop();
                        const newLength = target.length;
                        const event: StateEvent = {
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
                    return function(): any {
                        if (target.length === 0) return undefined;
                        const oldLength = target.length;
                        const oldValue = target[0];
                        const result = target.shift();
                        const newLength = target.length;
                        const event: StateEvent = {
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
                    return function(...items: any[]): number {
                        const oldLength = target.length;
                        const result = target.unshift(...items);
                        const newLength = target.length;
                         if (items.length > 0) {
                             const event: StateEvent = {
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
                    return function(start: number, deleteCount?: number, ...items: any[]): any[] {
                        const oldLength = target.length;
                        const actualStart = start < 0 ? Math.max(target.length + start, 0) : Math.min(start, target.length);
                        const deleteCountNum = deleteCount === undefined ? target.length - actualStart : Number(deleteCount);
                        const actualDeleteCount = Math.min(deleteCountNum, target.length - actualStart);
                        const deletedItems = target.slice(actualStart, actualStart + actualDeleteCount);
                        
                        const result = target.splice(start, deleteCountNum, ...items);
                        const newLength = target.length;

                        if (actualDeleteCount > 0 || items.length > 0) {
                            const event: StateEvent = {
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
                 // Handle iteration methods
                case Symbol.iterator:
                case 'values': // values() returns an iterator
                case 'keys':   // keys() returns an iterator
                case 'entries': // entries() returns an iterator
                     // Track dependency on iteration
                    track(target, Symbol.iterator);
                    // Fall through to Reflect.get and bind below
                    break;
                case 'forEach':
                case 'map':
                case 'filter':
                case 'reduce':
                case 'reduceRight':
                case 'find':
                case 'findIndex':
                case 'every':
                case 'some':
                case 'join': // join depends on iteration
                    // These methods depend on iteration
                    track(target, Symbol.iterator);
                     // Fall through to Reflect.get and bind below
                    break;
                case 'length':
                    // Explicitly track length access
                    track(target, 'length');
                    return Reflect.get(target, prop, receiver);
            }

            // Fallback for index access and other properties
            const value = Reflect.get(target, prop, receiver);

            // Handle index access: wrap retrieved element if it's an object
            const isNumericIndex = typeof prop === 'number' || (typeof prop === 'string' && !isNaN(parseInt(prop, 10)));

            if (isNumericIndex) {
                // Track access to specific index
                track(target, String(prop)); 
                 if (!isObject(value)) return value;

                 // Check wrapper cache for the element
                 const cachedValueProxy = wrapperCache.get(value);
                 if (cachedValueProxy) return cachedValueProxy;

                 // Calculate path for the element
                 const propKey = String(prop);
                 const pathKey = path.length > 0 ? `${path.join('.')}.${propKey}` : propKey; // Fix pathKey generation for index 0
                 let newPath = getPathConcat(pathKey);

                 if (newPath === undefined) {
                     newPath = path.concat(propKey);
                     setPathConcat(pathKey, newPath);
                 }

                 // Wrap based on type (no longer passing seen)
                 if (Array.isArray(value)) return wrapArray(value, emit, newPath);
                 if (value instanceof Map) return wrapMap(value, emit, newPath);
                 if (value instanceof Set) return wrapSet(value, emit, newPath);
                 if (value instanceof Date) return new Date(value.getTime()); // Dates are not proxied
                 // Default to wrapState for plain objects
                 return wrapState(value, emit, newPath);
            }

            // For non-numeric properties or properties that aren't objects, return value directly
            // Also handle functions bound to the target
            if (typeof value === 'function') {
                return value.bind(target);
            }
            return value;
        },
        set(target: T, prop: string | symbol, value: any, receiver: any): boolean {
            const oldValue = (target as any)[prop];

            // Fast path for primitive equality
            if (oldValue === value) return true;

            // Deep equality check with new WeakMap
            if (isObject(oldValue) && isObject(value) && deepEqual(oldValue, value, new WeakMap())) return true;

            const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            const result = Reflect.set(target, prop, value, receiver);

            const isNumericIndex = typeof prop === 'number' || (typeof prop === 'string' && !isNaN(parseInt(String(prop))));

            if (result && (!descriptor || !descriptor.set || isNumericIndex)) {
                 const propKey = String(prop);
                 const pathKey = path.length > 0 ? `${path.join('.')}.${propKey}` : propKey; // Fix pathKey generation for index 0
                let newPath = getPathConcat(pathKey);

                if (newPath === undefined) {
                    newPath = path.concat(propKey);
                    setPathConcat(pathKey, newPath);
                }

                const event: StateEvent = {
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

    // Cache the newly created proxy before returning
    wrapperCache.set(arr, proxy);
    return proxy;
} 