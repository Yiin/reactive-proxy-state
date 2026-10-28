/**
 * Returns the raw, original object underlying a reactive proxy.
 * If the input is not a proxy, returns the input itself.
 */
export declare function toRaw<T>(observed: T): T;
/**
 * Strip proxy refs from spread results before storing in raw state.
 * Prevents unbounded proxy nesting from `{ ...reactiveProxy }` patterns.
 */
export declare function unwrapForStore(value: any): any;
export declare const pathCache: WeakMap<object, Map<string, any>>;
export declare const globalSeen: WeakMap<any, any>;
export declare const wrapperCache: WeakMap<object, object>;
export declare const proxyStats: {
    created: number;
    arrays: number;
    maps: number;
    sets: number;
    objects: number;
    /** Number of old proxied values evicted when replaced via set trap */
    staleEvicted: number;
    /**
     * Writes through a proxy whose object is in no tree (it was removed, or
     * never placed). They change the object and emit nothing.
     */
    detachedWrites: number;
};
export declare function getProxyStats(): {
    pathConcatCacheSize: number;
    created: number;
    arrays: number;
    maps: number;
    sets: number;
    objects: number;
    /** Number of old proxied values evicted when replaced via set trap */
    staleEvicted: number;
    /**
     * Writes through a proxy whose object is in no tree (it was removed, or
     * never placed). They change the object and emit nothing.
     */
    detachedWrites: number;
};
export declare function resetProxyStats(): void;
export declare function deepEqual(a: any, b: any, seen?: WeakMap<any, any>): boolean;
export declare function getFromPathCache(root: object, pathKey: string): any | undefined;
export declare function setInPathCache(root: object, pathKey: string, value: any): void;
/**
 * Evict the cached path entry at `pathKey` AND all its descendants.
 * Called when a value at `pathKey` is replaced so that the stale cached reference
 * (and any deeper ones) are not reused on subsequent mutations.
 */
export declare function evictDescendantsFromPathCache(root: object, pathKey: string): void;
/**
 * recursively traverses an object or array, accessing each property/element.
 * used by `watch` with `deep: true` to establish dependencies on all nested properties.
 * the actual tracking is done by the proxy `get` handlers triggered during traversal.
 */
export declare function traverse(value: any, seen?: Set<any>): any;
/**
 * The most copies one snapshot may make beyond the first copy of each
 * object. A snapshot copies a shared object once per place, so a graph
 * that shares objects at many places (each level holding the one below
 * twice) grows exponentially: 22 objects become 4,194,303 copies. Such a
 * snapshot throws a `RangeError` instead. A tree, however large, makes no
 * extra copies and is never refused.
 */
export declare const SNAPSHOT_SHARED_COPY_LIMIT = 100000;
/** A snapshot over `SNAPSHOT_SHARED_COPY_LIMIT`. */
export declare class SnapshotLimitError extends RangeError {
    constructor(extraCopies: number);
}
/**
 * Deep clone for event payloads. Unlike `deepClone`, an object that appears
 * at several places in `value` is copied once per place, so the result is a
 * tree: a replica holds one copy per place, and a write through a shared
 * object emits one event per place. Copies may not share objects, because a
 * wire that keeps identity (structuredClone, an in-process listener) would
 * then hold one object where the source has several places, and apply each
 * per-place event to it again. Cycles are kept.
 *
 * Throws a `SnapshotLimitError` (a `RangeError`) when the copy would make more than
 * `SNAPSHOT_SHARED_COPY_LIMIT` extra copies of shared objects.
 */
export declare function cloneTree<T>(value: T): T;
/** What `cloneTreeUnless` returns for a value that reaches the object it names. */
export declare const REACHES: unique symbol;
/**
 * `cloneTree(value)`, or `REACHES` as soon as the copy (or its measure)
 * meets `container`. A `SnapshotLimitError` thrown first is measured on
 * objects other than `container`.
 */
export declare function cloneTreeUnless<T>(value: T, container: object): T | typeof REACHES;
/**
 * The copy `cloneTree(value)` makes once `container` holds what `contents`
 * holds: wherever the copy (and its measure) meets `container`, it reads
 * `contents` instead, a shallow copy of `container` of the same kind. So a
 * payload is copied, or refused, as it will be after a write to `container`,
 * before that write is made.
 */
export declare function cloneTreeAfter<T>(value: T, container: object, contents: object): T;
/**
 * creates a deep clone of a value.
 * includes cycle detection using a weakmap.
 */
export declare function deepClone<T>(value: T, seen?: WeakMap<WeakKey, any>): T;
