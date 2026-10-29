import type { LocationNode } from "./location";
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
export declare const locationNodes: WeakMap<object, LocationNode>;
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
 * A write the library cannot synchronize, refused before anything changed.
 * See "Supported inputs" under "Synchronization Limits" in the README.
 */
export declare class UnsupportedStateError extends TypeError {
    constructor(problem: string);
}
/**
 * Which arrays of a payload copy keep their named (non-index) properties.
 * Finding them costs a key list per array, so only the payloads 1.0.44 sent
 * as the value itself keep them: the initial replace, inserted values and
 * what a write removes. Reorders also keep properties below the reordered
 * array. Assignment `newValue` copies keep array items only, as in 1.0.44.
 */
export declare const enum Named {
    /** No array: its items only. */
    None = 0,
    /** Arrays below `items`, `oldValues`, or the reordered array. */
    Below = 1,
    /** Every array. */
    All = 2
}
/**
 * Deep clone for event payloads. Unlike `deepClone`, an object that appears
 * at several places in `value` is copied once per place, so the result is a
 * tree: a replica holds one copy per place, and a write through a shared
 * object emits one event per place. Copies may not share objects, because a
 * wire that keeps identity (structuredClone, an in-process listener) would
 * then hold one object where the source has several places, and apply each
 * per-place event to it again. Cycles are kept. Every own enumerable data
 * property is copied as an own data property (also `__proto__`), and an
 * array's holes stay holes; `named` says which arrays keep their named
 * properties. Levels deeper than `FILL_DEPTH` take no stack frame, so any
 * depth fits.
 *
 * Throws a `SnapshotLimitError` (a `RangeError`) when the copy would make more than
 * `SNAPSHOT_SHARED_COPY_LIMIT` extra copies of shared objects.
 */
export declare function cloneTree<T>(value: T, named: Named): T;
/** What `cloneTreeUnless` returns for a value that reaches the object it names. */
export declare const REACHES: unique symbol;
/**
 * `cloneTree(value, named)`, or `REACHES` as soon as the copy (or its
 * measure) meets `container`. A `SnapshotLimitError` thrown first is
 * measured on objects other than `container`.
 */
export declare function cloneTreeUnless<T>(value: T, container: object, named: Named): T | typeof REACHES;
/**
 * `cloneTreeUnless(value, container, named)` for a value about to be stored
 * (the new value of a write, inserted items, a new root; `container` may be
 * undefined). It also finds whether the value is fresh: no object in it has
 * a location node, and no object sits at two places in it (an alias or a
 * cycle). `copiedFresh` says so when the call returns. The place walk of a
 * store finds nothing to do in a fresh value, so the store skips it (see
 * `attachValue`). The check stops at the first object that is not fresh.
 */
export declare function cloneStored<T>(value: T, container: object | undefined, named: Named): T | typeof REACHES;
/** Whether the value the last `cloneStored` call copied is fresh; set when it returns. */
export declare let copiedFresh: boolean;
/**
 * The copy `cloneTree(value, named)` makes once `container` holds what
 * `contents` holds: wherever the copy (and its measure) meets `container`,
 * it reads `contents` instead, a shallow copy of `container` of the same
 * kind. So a payload is copied, or refused, as it will be after a write to
 * `container`, before that write is made.
 */
export declare function cloneTreeAfter<T>(value: T, container: object, contents: object, named: Named): T;
/**
 * The enumerable string and symbol keys of `array` other than indexes.
 * Indexes come first among string keys. Undefined when no keys remain.
 */
export declare function namedKeys(array: object): (string | symbol)[] | undefined;
/** `object[key] = value` as an own enumerable data property: no setter runs, and `__proto__` stays a key. */
export declare function setData(object: object, key: PropertyKey, value: unknown): void;
export declare function keepCollectionIdentity(source: unknown, copy: unknown): void;
/** The member this replica holds for a source key or member, without comparing its contents. */
export declare function collectionMember(collection: Map<unknown, unknown> | Set<unknown>, member: unknown): unknown;
/**
 * creates a deep clone of a value.
 * includes cycle detection using a weakmap.
 */
export declare function deepClone<T>(value: T, seen?: WeakMap<WeakKey, any>): T;
