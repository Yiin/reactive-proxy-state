// Cache for memoized deepEqual results with cleanup
const deepEqualCache = new WeakMap();
const MAX_CACHE_SIZE = 1000; // Prevent unbounded growth
// Path traversal cache with LRU-like behavior
export const pathCache = new WeakMap();
const pathCacheSize = new WeakMap();
// Path concatenation cache with size limit
export const pathConcatCache = new Map();
const MAX_PATH_CACHE_SIZE = 1000;
// Global seen map for circular reference detection
export const globalSeen = new WeakMap();
// Global cache for proxy wrappers
export const wrapperCache = new WeakMap();
function cleanupPathCache(root) {
    const cache = pathCache.get(root);
    if (cache && pathCacheSize.get(root) > MAX_CACHE_SIZE) {
        // Clear oldest entries (first 20%)
        const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        let count = 0;
        for (const key of cache.keys()) {
            if (count >= entriesToRemove)
                break;
            cache.delete(key);
            count++;
        }
        pathCacheSize.set(root, MAX_CACHE_SIZE - entriesToRemove);
    }
}
function cleanupPathConcatCache() {
    if (pathConcatCache.size > MAX_PATH_CACHE_SIZE) {
        // Remove oldest entries (first 20%)
        const entriesToRemove = Math.floor(MAX_PATH_CACHE_SIZE * 0.2);
        let count = 0;
        for (const key of pathConcatCache.keys()) {
            if (count >= entriesToRemove)
                break;
            pathConcatCache.delete(key);
            count++;
        }
    }
}
export function deepEqual(a, b, seen = globalSeen) {
    // Fast path for primitive equality
    if (a === b)
        return true;
    // Fast path for null/undefined
    if (a == null || b == null)
        return a === b;
    // Fast path for different types
    if (typeof a !== typeof b)
        return false;
    // Fast path for Date objects
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    // Fast path for non-objects
    if (typeof a !== 'object')
        return false;
    // Fast path for different array types
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    // Check for circular references
    if (seen.has(a))
        return seen.get(a) === b;
    seen.set(a, b);
    // Check cache for memoized results
    if (deepEqualCache.has(a) && deepEqualCache.get(a)?.has(b)) {
        return deepEqualCache.get(a).get(b);
    }
    // Initialize cache for this object if needed
    if (!deepEqualCache.has(a)) {
        deepEqualCache.set(a, new WeakMap());
    }
    let result;
    // Compare arrays
    if (Array.isArray(a)) {
        if (a.length !== b.length) {
            result = false;
        }
        else {
            result = a.every((val, idx) => deepEqual(val, b[idx], seen));
        }
    }
    else {
        // Compare objects
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) {
            result = false;
        }
        else {
            result = keysA.every(key => deepEqual(a[key], b[key], seen));
        }
    }
    // Cache the result
    deepEqualCache.get(a).set(b, result);
    return result;
}
// Helper to safely get from path cache with cleanup
export function getFromPathCache(root, pathKey) {
    const cache = pathCache.get(root);
    if (!cache)
        return undefined;
    const result = cache.get(pathKey);
    if (result !== undefined) {
        // Move to end (most recently used)
        cache.delete(pathKey);
        cache.set(pathKey, result);
    }
    return result;
}
// Helper to safely set in path cache with cleanup
export function setInPathCache(root, pathKey, value) {
    if (!pathCache.has(root)) {
        pathCache.set(root, new Map());
        pathCacheSize.set(root, 0);
    }
    const cache = pathCache.get(root);
    const size = pathCacheSize.get(root);
    // If key exists, remove it first (will be added at end)
    if (cache.has(pathKey)) {
        cache.delete(pathKey);
    }
    cache.set(pathKey, value);
    pathCacheSize.set(root, size + 1);
    cleanupPathCache(root);
}
// Helper to safely get/set path concatenation with cleanup
export function getPathConcat(path) {
    const result = pathConcatCache.get(path);
    if (result !== undefined) {
        // Move to end (most recently used)
        pathConcatCache.delete(path);
        pathConcatCache.set(path, result);
    }
    return result;
}
export function setPathConcat(path, value) {
    pathConcatCache.set(path, value);
    cleanupPathConcatCache();
}
// Helper to check if a value is an object (and not null)
function isObject(val) {
    return val !== null && typeof val === 'object';
}
/**
 * Recursively traverses an object to track all nested properties.
 * Used for deep watching.
 * @param value - The value to traverse.
 * @param seen - A Set to handle circular references.
 */
export function traverse(value, seen = new Set()) {
    if (!isObject(value) || seen.has(value)) {
        return value;
    }
    seen.add(value);
    // Traverse arrays
    if (Array.isArray(value)) {
        // Access length for tracking
        value.length;
        for (let i = 0; i < value.length; i++) {
            traverse(value[i], seen);
        }
    }
    // Traverse Sets and Maps
    else if (value instanceof Set || value instanceof Map) {
        for (const v of value) {
            // For Maps, traverse both keys (if objects) and values
            if (Array.isArray(v)) {
                traverse(v[0], seen); // Key
                traverse(v[1], seen); // Value
            }
            else {
                traverse(v, seen); // Value for Set
            }
        }
        // --- Stop after handling Map/Set --- 
        return value;
    }
    // Traverse plain objects (Only if not Array, Map, or Set)
    else {
        for (const key in value) {
            // Access the property to trigger tracking via the proxy's get handler
            traverse(value[key], seen);
        }
    }
    return value;
}
/**
 * Creates a deep clone of a value.
 * Handles primitives, Dates, Arrays, Maps, Sets, and plain objects.
 * Includes cycle detection.
 * @param value The value to clone.
 * @param seen A WeakMap to handle circular references during recursion.
 * @returns A deep clone of the value.
 */
export function deepClone(value, seen = new WeakMap()) {
    // Primitives and null are returned directly
    if (value === null || typeof value !== 'object') {
        return value;
    }
    // Handle Dates
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    // Handle cycles
    if (seen.has(value)) {
        return seen.get(value);
    }
    // Handle Arrays
    if (Array.isArray(value)) {
        const newArray = [];
        seen.set(value, newArray);
        for (let i = 0; i < value.length; i++) {
            newArray[i] = deepClone(value[i], seen);
        }
        return newArray;
    }
    // Handle Maps
    if (value instanceof Map) {
        const newMap = new Map();
        seen.set(value, newMap);
        value.forEach((val, key) => {
            // Clone both key and value in case they are objects
            newMap.set(deepClone(key, seen), deepClone(val, seen));
        });
        return newMap;
    }
    // Handle Sets
    if (value instanceof Set) {
        const newSet = new Set();
        seen.set(value, newSet);
        value.forEach(val => {
            newSet.add(deepClone(val, seen));
        });
        return newSet;
    }
    // Handle plain objects
    // Create object with same prototype
    const newObject = Object.create(Object.getPrototypeOf(value));
    seen.set(value, newObject);
    // Copy properties
    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            newObject[key] = deepClone(value[key], seen);
        }
    }
    // Copy symbol properties (if any)
    const symbolKeys = Object.getOwnPropertySymbols(value);
    for (const symbolKey of symbolKeys) {
        // Check if property descriptor exists and has get/set or is value
        const descriptor = Object.getOwnPropertyDescriptor(value, symbolKey);
        if (descriptor && (descriptor.value !== undefined || descriptor.get || descriptor.set)) {
            newObject[symbolKey] = deepClone(value[symbolKey], seen);
        }
    }
    return newObject;
}
