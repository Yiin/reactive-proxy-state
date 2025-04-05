import { EmitFunction, Path, StateEvent } from './types';
import { getPathConcat, setPathConcat, wrapperCache } from './utils';
import { reactive } from './reactive';
import { wrapArray } from './wrapArray';
import { wrapMap } from './wrapMap';
import { track, trigger } from './watchEffect';

export function wrapSet<T>(set: Set<T>, emit: EmitFunction, path: Path): Set<T> {
    // Check wrapper cache first
    const cachedProxy = wrapperCache.get(set);
    if (cachedProxy) return cachedProxy as Set<T>;

    const proxy = new Proxy(set, {
        get(target: Set<T>, prop: string | symbol, receiver: any): any {
            // Original track call
            track(target, prop);
            
            if (prop === 'add') {
                return function (value: T): Set<T> {
                    const existed = target.has(value);
                    const oldSize = target.size; 

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
                    return receiver;
                };
            }
            if (prop === 'delete') {
                return function (value: T): boolean {
                    const existed = target.has(value);
                    const oldSize = target.size; 

                    if (existed) {
                        const oldValue = value; // The value being deleted is the oldValue
                        const result = target.delete(value);
                        const newSize = target.size; 

                        if (result) { 
                           const event: StateEvent = {
                                action: 'set-delete',
                                path: path,
                                value: value, // value being deleted
                                oldValue: oldValue // Add oldValue to the event
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
                        action: 'set-clear', // Create 'set-clear' action
                        path: path,
                        value: null 
                    };
                    emit(event);
                    // Clear triggers both iterator and size
                    trigger(target, Symbol.iterator);
                    if (oldSize !== newSize) {
                        trigger(target, 'size');
                    }
                };
            }
            if (prop === 'has') {
                // 'has' depends on the specific value and iteration/size
                 track(target, Symbol.iterator); // Track iteration implicitly
                return function(value: T): boolean {
                    // Also track the specific value when 'has' is called
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol') {
                        track(target, String(value));
                    }
                    // How to track non-primitive values?
                    // We might need a different strategy for object keys in Sets/Maps if deep reactivity on keys is needed
                    return target.has(value);
                }.bind(target); // Bind to original target
            }
            // Handle iteration methods - custom implementation already tracks
            if (prop === 'values' || prop === Symbol.iterator || prop === 'entries' || prop === 'keys' || prop === 'forEach') {
                // Track dependency on iteration
                track(target, Symbol.iterator);
                const originalMethod = Reflect.get(target, prop, receiver);
                // Return a function that yields wrapped values (or calls forEach)
                if (prop === 'forEach') {
                    return (callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void => {
                        // Simplified forEach based on values iterator
                         const valuesIterator = proxy.values(); // Use the proxied values() to get wrapped values + tracking
                         for (const value of valuesIterator) {
                             callbackfn.call(thisArg, value, value, proxy);
                         }
                    }
                }
                 // Handle Symbol.iterator, values, keys, entries
                 return function* (...args: any[]) {
                    let index = 0; // Index for path generation
                    const iterator = originalMethod.apply(target, args);

                    for (const entry of iterator) {
                        let valueToWrap = entry; // Default for values(), keys()
                        let mapKey = undefined; // For entries()

                        // For entries(), the entry is [key, value]
                        if (prop === 'entries') {
                            mapKey = entry[0];
                            valueToWrap = entry[1];
                        }

                        // Track access to each element during iteration
                        track(target, String(index));

                        let wrappedValue = valueToWrap;
                        if (valueToWrap && typeof valueToWrap === 'object') {
                             // Check wrapper cache first
                             const cachedValueProxy = wrapperCache.get(valueToWrap);
                             if (cachedValueProxy) {
                                 wrappedValue = cachedValueProxy;
                             } else {
                                 // Calculate path using index (or mapKey if available and primitive)
                                 const keyForPath = (mapKey !== undefined && (typeof mapKey !== 'object') ? String(mapKey) : String(index));
                                 const pathKey = path.length > 0 ? `${path.join('.')}.${keyForPath}` : keyForPath;
                                 let newPath = getPathConcat(pathKey);
                                 if (newPath === undefined) {
                                     newPath = path.concat(keyForPath);
                                     setPathConcat(pathKey, newPath);
                                 }

                                 // Wrap based on type
                                 if (valueToWrap instanceof Map) wrappedValue = wrapMap(valueToWrap, emit, newPath);
                                 else if (valueToWrap instanceof Set) wrappedValue = wrapSet(valueToWrap, emit, newPath);
                                 else if (Array.isArray(valueToWrap)) wrappedValue = wrapArray(valueToWrap, emit, newPath);
                                 else if (valueToWrap instanceof Date) wrappedValue = new Date(valueToWrap.getTime());
                                 else wrappedValue = reactive(valueToWrap, emit, newPath);
                                 // Note: We don't cache the *wrapped* value here, wrap functions handle caching
                             }
                        }

                        // Yield the original or wrapped value/entry
                        if (prop === 'entries') {
                            yield [mapKey, wrappedValue];
                        } else {
                            yield wrappedValue;
                        }
                        index++;
                    }
                };
            }
             if (prop === 'size') {
                // Explicitly track size access
                track(target, 'size');
                 // Return the size directly from the target to avoid potential 'this' issues with Reflect.get
                return target.size;
            }

            // Fallback for other properties (should be minimal for Set)
            const value = Reflect.get(target, prop, receiver);

            // REMOVED - Tracking handled above
            // if (prop === 'size') { ... }

            // If the property is a function (and not handled above), return it directly.
            // Reflect.get preserves the correct 'this' binding (receiver).
            // REMOVED: return value.bind(target);
            
            return value;
        }
    });

    // Cache the newly created proxy before returning
    wrapperCache.set(set, proxy);
    return proxy;
} 