import { EmitFunction, Path, StateEvent } from './types';
import { deepEqual, pathConcatCache, getPathConcat, setPathConcat, wrapperCache } from './utils';
import { wrapState } from './wrapState';
import { wrapArray } from './wrapArray';
import { wrapSet } from './wrapSet';
import { track, trigger } from './watchEffect';

export function wrapMap<K, V>(map: Map<K, V>, emit: EmitFunction, path: Path): Map<K, V> {
    // Check wrapper cache first
    const cachedProxy = wrapperCache.get(map);
    if (cachedProxy) return cachedProxy as Map<K, V>;

    const proxy = new Proxy(map, {
        get(target: Map<K, V>, prop: string | symbol, receiver: any): any {
            // Original track call - Keep for properties not explicitly handled
            track(target, prop);
            
            // --- Specific Method Handlers ---
            if (prop === 'set') {
                return function (key: K, value: V): Map<K, V> {
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
                    emit(event);

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
            }
            if (prop === 'delete') {
                return function (key: K): boolean {
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
                return function (): void {
                    const oldSize = target.size;
                    if (oldSize === 0) return; 
                    
                    target.clear();
                    const newSize = target.size; 
                    
                    const event: StateEvent = {
                        action: 'map-clear',
                        path: path,
                        key: null
                    };
                    emit(event);

                    // Clear triggers both iterator and size
                    trigger(target, Symbol.iterator); 
                    if (oldSize !== newSize) {
                       trigger(target, 'size');
                    }
                };
            }
            if (prop === 'get') {
                // Return function that tracks the specific key upon execution
                return function (key: K): any {
                    // Track access to this specific key when 'get' is called
                    track(target, String(key)); 
                    const value = target.get(key);
                    
                    if (!value || typeof value !== 'object') return value; // Fast path for non-objects

                    // Check wrapper cache for the value
                    const cachedValueProxy = wrapperCache.get(value);
                    if (cachedValueProxy) return cachedValueProxy;

                    // Calculate path for the value
                    const keyString = String(key);
                    const pathKey = path.length > 0 ? `${path.join('.')}.${keyString}` : keyString;
                    let newPath = getPathConcat(pathKey);

                    if (newPath === undefined) {
                        newPath = path.concat(keyString);
                        setPathConcat(pathKey, newPath);
                    }

                    // Wrap based on type (no longer passing seen)
                    if (value instanceof Map) return wrapMap(value, emit, newPath);
                    if (value instanceof Set) return wrapSet(value, emit, newPath);
                    if (Array.isArray(value)) return wrapArray(value, emit, newPath);
                    if (value instanceof Date) return new Date(value.getTime()); // Dates are not proxied

                    // Default to wrapState for plain objects
                    return wrapState(value, emit, newPath);
                };
            }
            if (prop === 'has') {
                // Track dependency on iteration/structure when 'has' is accessed
                track(target, Symbol.iterator);
                return function(key: K): boolean {
                    // Track specific key when 'has' is called
                    track(target, String(key));
                    return target.has(key);
                }.bind(target); // Bind to original target for correct 'this'
            }
            
            // --- Iteration Methods ---
            if (prop === Symbol.iterator || prop === 'entries' || prop === 'values' || prop === 'keys' || prop === 'forEach') {
                // Track dependency on iteration when these methods are accessed
                track(target, Symbol.iterator);
                const originalMethod = Reflect.get(target, prop, receiver);

                // Return custom iterators/forEach that wrap values
                if (prop === 'forEach') {
                     return (callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void => {
                         // Use proxied .entries() to get wrapped values + tracking
                         const entriesIterator = proxy.entries(); 
                         for (const [key, value] of entriesIterator) {
                             callbackfn.call(thisArg, value, key, proxy);
                         }
                     }
                }

                // Handle Symbol.iterator, entries, values, keys
                return function* (...args: any[]) {
                    const iterator = originalMethod.apply(target, args);

                    for (const entry of iterator) {
                        let keyToWrap = entry; // Default for keys()
                        let valueToWrap = entry; // Default for values()
                        let isEntry = false;

                        if (prop === 'entries' || prop === Symbol.iterator) {
                            keyToWrap = entry[0];
                            valueToWrap = entry[1];
                            isEntry = true;
                        }
                        
                        // Wrap key if object
                        let wrappedKey = keyToWrap;
                        if (isEntry && keyToWrap && typeof keyToWrap === 'object') {
                            const pathKey = path.length > 0 ? `${path.join('.')}.${String(keyToWrap)}` : String(keyToWrap); // Or find better key path?
                            let keyPath = getPathConcat(pathKey); // Reuse paths where possible
                            if (keyPath === undefined) {
                                keyPath = path.concat(String(keyToWrap)); // Simplification for key path
                                setPathConcat(pathKey, keyPath);
                            }
                            // TODO: Decide if Map keys should be deeply reactive
                            wrappedKey = wrapState(keyToWrap, emit, keyPath); 
                        }
                        
                        // Wrap value if object
                        let wrappedValue = valueToWrap;
                        if (valueToWrap && typeof valueToWrap === 'object') {
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
                                 
                                 if (valueToWrap instanceof Map) wrappedValue = wrapMap(valueToWrap, emit, newPath);
                                 else if (valueToWrap instanceof Set) wrappedValue = wrapSet(valueToWrap, emit, newPath);
                                 else if (Array.isArray(valueToWrap)) wrappedValue = wrapArray(valueToWrap, emit, newPath);
                                 else if (valueToWrap instanceof Date) wrappedValue = new Date(valueToWrap.getTime());
                                 else wrappedValue = wrapState(valueToWrap, emit, newPath);
                             }
                        }

                        // Yield based on iterator type
                        if (prop === 'entries' || prop === Symbol.iterator) {
                            yield [wrappedKey, wrappedValue];
                        } else if (prop === 'values') {
                            yield wrappedValue;
                        } else { // keys
                            yield wrappedKey;
                        }
                    }
                };
            }
            
            // --- Size Property ---
            if (prop === 'size') {
                // Explicitly track size access
                track(target, 'size');
                // Return the size directly from the target to avoid potential 'this' issues with Reflect.get
                return target.size;
            }

            // --- Fallback for other properties/methods ---
            const value = Reflect.get(target, prop, receiver);

            // For non-function properties or bound functions, return the value as is.
            return value;
        }
    });

    // Cache the newly created proxy before returning
    wrapperCache.set(map, proxy);
    return proxy;
} 