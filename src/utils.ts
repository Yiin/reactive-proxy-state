import { ReactiveFlags } from "./constants";

/**
 * Returns the raw, original object underlying a reactive proxy.
 * If the input is not a proxy, returns the input itself.
 */
export function toRaw<T>(observed: T): T {
  let value = observed as any
  while (value && value[ReactiveFlags.RAW]) {
    value = value[ReactiveFlags.RAW]
  }
  return value
}

/**
 * Strip proxy refs from spread results before storing in raw state.
 * Prevents unbounded proxy nesting from `{ ...reactiveProxy }` patterns.
 */
export function unwrapForStore(value: any): any {
  // If the value itself is reactive, unwrap it — the raw object's
  // children are already raw (they only appear wrapped through proxy get traps)
  if (value[ReactiveFlags.IS_REACTIVE]) return toRaw(value)
  // For plain objects/arrays that may contain proxy refs from spreading,
  // unwrap each direct child in-place
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const child = value[i]
      if (child != null && typeof child === 'object' && child[ReactiveFlags.IS_REACTIVE]) {
        value[i] = toRaw(child)
      }
    }
  } else if (!(value instanceof Map) && !(value instanceof Set) && !(value instanceof Date)) {
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue
      const child = value[key]
      if (child != null && typeof child === 'object' && child[ReactiveFlags.IS_REACTIVE]) {
        value[key] = toRaw(child)
      }
    }
  }
  return value
}

// cache for memoized deepEqual results, using weakmap to avoid memory leaks
const deepEqualCache = new WeakMap<object, WeakMap<object, boolean>>();
const MAX_CACHE_SIZE = 1000;

// path traversal cache (object -> pathString -> value) with lru-like behavior
// weakmap for the root object ensures the cache entry is garbage collected when the object is
export const pathCache = new WeakMap<object, Map<string, any>>();
const pathCacheSize = new WeakMap<object, number>(); // track individual map sizes

// path concatenation cache ('a.b.c' -> ['a', 'b', 'c']) with size limit
export const pathConcatCache = new Map<string, any[]>();
const MAX_PATH_CACHE_SIZE = 1000;

// global weakmap for wrapper identity: raw object -> its reactive proxy.
// Written only by the wrap-* modules and evictDeep; must NOT be reused as
// cycle-detection scratch space (deepEqual/deepClone use per-call maps),
// because WeakMap values are strong refs and scratch entries would pin
// whole compared state trees and could poison wrapper lookups.
export const globalSeen = new WeakMap<any, any>();

// global cache to reuse proxy wrappers for the same original object
export const wrapperCache = new WeakMap<object, object>();

// ── Instrumentation counters (near-zero overhead) ──

export const proxyStats = {
  created: 0,
  arrays: 0,
  maps: 0,
  sets: 0,
  objects: 0,
  /** Number of old proxied values evicted when replaced via set trap */
  staleEvicted: 0,
}

export function getProxyStats() {
  return { ...proxyStats, pathConcatCacheSize: pathConcatCache.size }
}

export function resetProxyStats() {
  proxyStats.created = 0
  proxyStats.arrays = 0
  proxyStats.maps = 0
  proxyStats.sets = 0
  proxyStats.objects = 0
  proxyStats.staleEvicted = 0
}

/**
 * Recursively evict an object and all its nested children from proxy caches.
 * This allows GC to collect the entire old object tree when a property is
 * replaced, not just the top-level value.
 */
export function evictDeep(value: any): void {
  if (value == null || typeof value !== 'object') return
  // Unwrap so we evict the raw object, not the proxy wrapper
  value = toRaw(value)
  if (!globalSeen.has(value)) return // not proxied, skip entire subtree

  globalSeen.delete(value)
  wrapperCache.delete(value)
  proxyStats.staleEvicted++

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (value[i] != null && typeof value[i] === 'object') {
        evictDeep(value[i])
      }
    }
  } else if (value instanceof Map) {
    for (const v of value.values()) {
      if (v != null && typeof v === 'object') evictDeep(v)
    }
  } else if (value instanceof Set) {
    for (const v of value) {
      if (v != null && typeof v === 'object') evictDeep(v)
    }
  } else {
    const keys = Object.keys(value)
    for (let i = 0; i < keys.length; i++) {
      const child = value[keys[i]]
      if (child != null && typeof child === 'object') {
        evictDeep(child)
      }
    }
  }
}

// simple lru-like cleanup for individual object path caches
function cleanupPathCache(root: object) {
    const cache = pathCache.get(root);
    if (cache && pathCacheSize.get(root)! > MAX_CACHE_SIZE) {
        // clear oldest entries (first 20%)
        const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        let count = 0;
        for (const key of cache.keys()) {
            if (count >= entriesToRemove) break;
            cache.delete(key);
            count++;
        }
        pathCacheSize.set(root, MAX_CACHE_SIZE - entriesToRemove);
    }
}

// simple lru-like cleanup for the global path concatenation cache
function cleanupPathConcatCache() {
    if (pathConcatCache.size > MAX_PATH_CACHE_SIZE) {
        // remove oldest entries (first 20%)
        const entriesToRemove = Math.floor(MAX_PATH_CACHE_SIZE * 0.2);
        let count = 0;
        for (const key of pathConcatCache.keys()) {
            if (count >= entriesToRemove) break;
            pathConcatCache.delete(key);
            count++;
        }
    }
}

// `seen` defaults to a fresh WeakMap per call: it is cycle-detection scratch
// space and must never fall back to the shared `globalSeen` identity map,
// whose values strongly retain whatever they point at (leak + poisoning).
// `seen` defaults to a fresh WeakMap per call: it is cycle-detection scratch
// space and must never fall back to the shared `globalSeen` identity map,
// whose values strongly retain whatever they point at (leak + poisoning).
export function deepEqual(a: any, b: any, seen: WeakMap<any, any> = new WeakMap()): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    // handle circular references
    if (seen.has(a)) return seen.get(a) === b;
    seen.set(a, b);

    // check memoization cache before diving deeper
    if (deepEqualCache.has(a) && deepEqualCache.get(a)?.has(b)) {
        return deepEqualCache.get(a)!.get(b)!;
    }

    if (!deepEqualCache.has(a)) {
        deepEqualCache.set(a, new WeakMap());
    }

    let result: boolean;
    if (Array.isArray(a)) {
        result = a.length === b.length && a.every((val, idx) => deepEqual(val, b[idx], seen));
    } else if (a instanceof Map && b instanceof Map) {
        result = a.size === b.size;
        if (result) {
            for (const [key, value] of a) {
                if (!b.has(key) || !deepEqual(value, b.get(key), seen)) {
                    result = false;
                    break;
                }
            }
        }
    } else if (a instanceof Set && b instanceof Set) {
        result = a.size === b.size;
        if (result) {
            for (const value of a) {
                if (!b.has(value)) {
                    result = false;
                    break;
                }
            }
        }
    } else {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        result = keysA.length === keysB.length && keysA.every(key =>
            Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key], seen)
        );
    }

    // cache the result before returning
    deepEqualCache.get(a)!.set(b, result);
    return result;
}

export function getFromPathCache(root: object, pathKey: string): any | undefined {
    const cache = pathCache.get(root);
    if (!cache) return undefined;

    const result = cache.get(pathKey);
    if (result !== undefined) {
        // simulate lru by deleting and re-setting the key
        cache.delete(pathKey);
        cache.set(pathKey, result);
    }
    return result;
}

export function setInPathCache(root: object, pathKey: string, value: any): void {
    if (!pathCache.has(root)) {
        pathCache.set(root, new Map());
        pathCacheSize.set(root, 0);
    }
    const cache = pathCache.get(root)!;
    // adjust size only if the key is new
    if (!cache.has(pathKey)) {
        pathCacheSize.set(root, pathCacheSize.get(root)! + 1);
    } else {
        cache.delete(pathKey); // remove old entry before adding to end
    }
    cache.set(pathKey, value);
    cleanupPathCache(root); // check if cleanup is needed after adding
}

/**
 * Evict the cached path entry at `pathKey` AND all its descendants.
 * Called when a value at `pathKey` is replaced so that the stale cached reference
 * (and any deeper ones) are not reused on subsequent mutations.
 */
export function evictDescendantsFromPathCache(root: object, pathKey: string): void {
    const cache = pathCache.get(root);
    if (!cache) return;
    let evicted = 0;
    if (cache.has(pathKey)) {
        cache.delete(pathKey);
        evicted++;
    }
    const prefix = pathKey + '.';
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
            evicted++;
        }
    }
    if (evicted > 0) {
        pathCacheSize.set(root, (pathCacheSize.get(root) ?? cache.size) - evicted);
    }
}

export function getPathConcat(path: string): any[] | undefined {
    const result = pathConcatCache.get(path);
    if (result !== undefined) {
        // simulate lru
        pathConcatCache.delete(path);
        pathConcatCache.set(path, result);
    }
    return result;
}

export function setPathConcat(path: string, value: any[]): void {
    // delete first to ensure it's added at the end (most recent)
    if (pathConcatCache.has(path)) {
        pathConcatCache.delete(path);
    }
    pathConcatCache.set(path, value);
    cleanupPathConcatCache(); // check size limit
}

function isObject(val: any): val is object {
  return val !== null && typeof val === 'object';
}

/**
 * recursively traverses an object or array, accessing each property/element.
 * used by `watch` with `deep: true` to establish dependencies on all nested properties.
 * the actual tracking is done by the proxy `get` handlers triggered during traversal.
 */
export function traverse(value: any, seen: Set<any> = new Set()) {
  if (!isObject(value) || seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.length; // track length to catch push/pop/assign beyond length
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (value instanceof Set || value instanceof Map) {
      // For reactive Map/Set, use the raw object to avoid triggering iterator tracking
      // But still touch size on the reactive wrapper to establish a dependency for add/delete
      (value as any).size;
      const rawValue = (value as any).__v_raw || value;
      for (const v of rawValue) {
          if (Array.isArray(v)) { // map entries [key, value]
              traverse(v[0], seen); // key
              traverse(v[1], seen); // value
          } else { // set values
              traverse(v, seen);
          }
      }
      return value; // no need to iterate plain object keys for map/set
  } else {
      // Touch keys length explicitly to register ITERATE dependency for property add/delete
      Object.keys(value as any).length;
      for (const key in value) {
          traverse((value as any)[key], seen);
      }
  }
  return value;
}

/**
 * creates a deep clone of a value.
 * includes cycle detection using a weakmap.
 */
export function deepClone<T>(value: T, seen = new WeakMap()): T {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (value instanceof Date) {
        return new Date(value.getTime()) as any;
    }
    // Identity must come from the raw target, not the proxy: proxy identities
    // are not stable across traversals when a proxy is stored inside a raw
    // tree it descends from (e.g. a child holds a proxy ref back to an
    // ancestor) — each lap mints a "new" wrapper at the get trap, so a
    // proxy-keyed `seen` guard never hits and the clone recurses forever
    // (vangrd-fi56i). Reads still go through `value` on purpose: the vue3
    // bridge establishes watchEffect dependencies by deep-reading state
    // through deepClone, and raw reads would silently drop those deps.
    const identity = toRaw(value) as object;
    if (seen.has(identity)) {
        return seen.get(identity);
    }

    if (Array.isArray(value)) {
        const newArray: any[] = [];
        seen.set(identity, newArray); // store ref before recursing
        for (let i = 0; i < value.length; i++) {
            newArray[i] = deepClone(value[i], seen);
        }
        return newArray as any;
    }

    if (value instanceof Map) {
        const newMap = new Map();
        seen.set(identity, newMap); // store ref before recursing
        value.forEach((val, key) => {
            newMap.set(deepClone(key, seen), deepClone(val, seen));
        });
        return newMap as any;
    }

    if (value instanceof Set) {
        const newSet = new Set();
        seen.set(identity, newSet); // store ref before recursing
        value.forEach(val => {
            newSet.add(deepClone(val, seen));
        });
        return newSet as any;
    }

    // handle plain objects
    const newObject = Object.create(Object.getPrototypeOf(value));
    seen.set(identity, newObject); // store ref before recursing

    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            newObject[key] = deepClone((value as any)[key], seen);
        }
    }
    // copy symbol properties
    const symbolKeys = Object.getOwnPropertySymbols(value);
    for(const symbolKey of symbolKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, symbolKey);
        if (descriptor && Object.prototype.propertyIsEnumerable.call(value, symbolKey)) {
             newObject[symbolKey] = deepClone((value as any)[symbolKey], seen);
        }
    }

    return newObject;
}
