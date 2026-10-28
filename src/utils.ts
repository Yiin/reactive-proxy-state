import { ReactiveFlags } from "./constants";
import type { LocationNode } from "./location";

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

const MAX_CACHE_SIZE = 1000;

// path traversal cache (object -> pathString -> value) with lru-like behavior
// weakmap for the root object ensures the cache entry is garbage collected when the object is
export const pathCache = new WeakMap<object, Map<string, any>>();
const pathCacheSize = new WeakMap<object, number>(); // track individual map sizes


// global weakmap for wrapper identity: raw object -> its reactive proxy.
// Written only by the wrap-* modules and location.ts; must NOT be reused as
// cycle-detection scratch space (deepEqual/deepClone use per-call maps),
// because WeakMap values are strong refs and scratch entries would pin
// whole compared state trees and could poison wrapper lookups.
export const globalSeen = new WeakMap<any, any>();

// global cache to reuse proxy wrappers for the same original object
export const wrapperCache = new WeakMap<object, object>();

// raw object -> where it sits in its state tree (see location.ts). Kept here
// with the other identity maps, so a payload copy can tell whether the value
// it copies holds objects the tree already knows (see `cloneStored`).
export const locationNodes = new WeakMap<object, LocationNode>();

// ── Instrumentation counters (near-zero overhead) ──

export const proxyStats = {
  created: 0,
  arrays: 0,
  maps: 0,
  sets: 0,
  objects: 0,
  /** Number of old proxied values evicted when replaced via set trap */
  staleEvicted: 0,
  /**
   * Writes through a proxy whose object is in no tree (it was removed, or
   * never placed). They change the object and emit nothing.
   */
  detachedWrites: 0,
}

export function getProxyStats() {
  // pathConcatCacheSize: the path cache is gone; kept at 0 so the shape stays
  return { ...proxyStats, pathConcatCacheSize: 0 }
}

export function resetProxyStats() {
  proxyStats.created = 0
  proxyStats.arrays = 0
  proxyStats.maps = 0
  proxyStats.sets = 0
  proxyStats.objects = 0
  proxyStats.staleEvicted = 0
  proxyStats.detachedWrites = 0
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

// `seen` is cycle-detection scratch space for one comparison: made on the
// first step into a nested object, never shared, and never the global
// `globalSeen` identity map, whose values strongly retain whatever they
// point at (leak + poisoning). Results are not memoized: state objects
// change, and a remembered result would go stale.
export function deepEqual(a: any, b: any, seen?: WeakMap<any, any>): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    // handle circular references
    if (seen !== undefined) {
        if (seen.has(a)) return seen.get(a) === b;
        seen.set(a, b);
    }

    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            const left = a[i];
            if (left === undefined && !(i in a)) continue; // a hole in `a` matches anything
            const right = b[i];
            if (left === right) continue;
            if (isObject(left) && isObject(right)) seen ??= startSeen(a, b);
            if (!deepEqual(left, right, seen)) return false;
        }
        return true;
    }
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [key, left] of a) {
            if (!b.has(key)) return false;
            const right = b.get(key);
            if (left === right) continue;
            if (isObject(left) && isObject(right)) seen ??= startSeen(a, b);
            if (!deepEqual(left, right, seen)) return false;
        }
        return true;
    }
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        for (const value of a) {
            if (!b.has(value)) return false;
        }
        return true;
    }
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) return false;
    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (!hasOwn.call(b, key)) return false;
        const left = a[key];
        const right = b[key];
        if (left === right) continue;
        if (isObject(left) && isObject(right)) seen ??= startSeen(a, b);
        if (!deepEqual(left, right, seen)) return false;
    }
    return true;
}

function startSeen(a: object, b: object): WeakMap<any, any> {
    const seen = new WeakMap();
    seen.set(a, b);
    return seen;
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
 * The most copies one snapshot may make beyond the first copy of each
 * object. A snapshot copies a shared object once per place, so a graph
 * that shares objects at many places (each level holding the one below
 * twice) grows exponentially: 22 objects become 4,194,303 copies. Such a
 * snapshot throws a `RangeError` instead. A tree, however large, makes no
 * extra copies and is never refused.
 */
export const SNAPSHOT_SHARED_COPY_LIMIT = 100_000;

/** A snapshot over `SNAPSHOT_SHARED_COPY_LIMIT`. */
export class SnapshotLimitError extends RangeError {
    constructor(extraCopies: number) {
        super(
            `reactive-proxy-state: a snapshot would copy shared objects more than ` +
            `${SNAPSHOT_SHARED_COPY_LIMIT} extra times (counted ${extraCopies} before stopping; ` +
            `an object is copied once per place it holds). Nothing was changed. To remove such a ` +
            `graph, see "Shared graphs have a copy limit" under "Synchronization Limits" in the README`
        );
        this.name = 'SnapshotLimitError';
    }
}

/**
 * A write the library cannot synchronize, refused before anything changed.
 * See "Supported inputs" under "Synchronization Limits" in the README.
 */
export class UnsupportedStateError extends TypeError {
    constructor(problem: string) {
        super(
            `reactive-proxy-state: ${problem}. Nothing was changed. See "Supported inputs" under ` +
            `"Synchronization Limits" in the README`
        );
        this.name = 'UnsupportedStateError';
    }
}

/**
 * Copies a snapshot makes before it measures its whole value against the
 * limit. Extra copies never outnumber copies, so a smaller snapshot cannot
 * pass the limit and is never measured.
 */
const SNAPSHOT_CHECK_AFTER = SNAPSHOT_SHARED_COPY_LIMIT + 1;

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
export function cloneTree<T>(value: T): T {
    return copyTree(value, undefined, undefined, false) as T;
}

/** What `cloneTreeUnless` returns for a value that reaches the object it names. */
export const REACHES = Symbol('reaches');

/**
 * `cloneTree(value)`, or `REACHES` as soon as the copy (or its measure)
 * meets `container`. A `SnapshotLimitError` thrown first is measured on
 * objects other than `container`.
 */
export function cloneTreeUnless<T>(value: T, container: object): T | typeof REACHES {
    return copyUnless(value, container, false) as T | typeof REACHES;
}

/**
 * `cloneTreeUnless(value, container)` for a value about to be stored (the
 * new value of a write, inserted items, a new root; `container` may be
 * undefined). It also finds whether the value is fresh: no object in it has
 * a location node, and no object sits at two places in it (an alias or a
 * cycle). `copiedFresh` says so when the call returns. The place walk of a
 * store finds nothing to do in a fresh value, so the store skips it (see
 * `attachValue`). The check stops at the first object that is not fresh.
 */
export function cloneStored<T>(value: T, container: object | undefined): T | typeof REACHES {
    return copyUnless(value, container, true) as T | typeof REACHES;
}

/** Whether the value the last `cloneStored` call copied is fresh; set when it returns. */
export let copiedFresh = false;

function copyUnless(value: unknown, container: object | undefined, checkFresh: boolean): unknown {
    try {
        return copyTree(value, container, undefined, checkFresh);
    } catch (error) {
        if (error === reachedContainer) {
            copiedFresh = false;
            return REACHES;
        }
        throw error;
    }
}

/**
 * The copy `cloneTree(value)` makes once `container` holds what `contents`
 * holds: wherever the copy (and its measure) meets `container`, it reads
 * `contents` instead, a shallow copy of `container` of the same kind. So a
 * payload is copied, or refused, as it will be after a write to `container`,
 * before that write is made.
 */
export function cloneTreeAfter<T>(value: T, container: object, contents: object): T {
    return copyTree(value, container, contents, false) as T;
}

const reachedContainer = new Error('reactive-proxy-state: internal, a copy reached its container');

/**
 * One tree copy in progress. Each `copyTree` call has its own, so a copy
 * made from a getter during another copy does not disturb it.
 */
interface CopyRun {
    /** The copied value (raw), measured against the limit when `countdown` reaches 0. */
    top: object;
    countdown: number;
    /** Where this copy's entries start in `cloneAncestors` and `cloneCopies`. */
    base: number;
    /** The container the copy stops at (`cloneTreeUnless`) or reads `contents` for (`cloneTreeAfter`). */
    container: object | undefined;
    contents: object | undefined;
    /** For `cloneStored`: true while every object met so far is fresh. */
    fresh: boolean;
    /** While `fresh`: the first object met below `top`, then a set of all of them. */
    first: object | undefined;
    seen: Set<object> | undefined;
}

function copyTree(
    value: unknown,
    container: object | undefined,
    contents: object | undefined,
    checkFresh: boolean
): unknown {
    if (value === null || typeof value !== 'object') {
        if (checkFresh) copiedFresh = true;
        return value;
    }
    const top = toRaw(value) as object;
    const base = cloneAncestors.length;
    const run: CopyRun = {
        top,
        countdown: SNAPSHOT_CHECK_AFTER,
        base,
        container,
        contents,
        fresh: checkFresh && locationNodes.get(top) === undefined,
        first: undefined,
        seen: undefined,
    };
    try {
        const copy = cloneTreeInto(value, run);
        if (checkFresh) copiedFresh = run.fresh;
        return copy;
    } finally {
        cloneAncestors.length = base;
        cloneCopies.length = base;
    }
}

/** What the copy reads for `identity` (a raw object): `run.contents` in place of `run.container`. */
function readsOf(identity: object, run: CopyRun): object {
    if (identity !== run.container) return identity;
    if (run.contents === undefined) throw reachedContainer;
    return run.contents;
}

/**
 * The countdown of `run` reached 0. While the copy is fresh, every copy so
 * far was the first copy of its object, so none was extra: count again.
 * Otherwise measure the whole value, once.
 */
function countdownDone(run: CopyRun): void {
    if (run.fresh) run.countdown = SNAPSHOT_CHECK_AFTER;
    else checkSharedCopies(run);
}

/** `run` stays fresh unless `value`, met below its top, has a location node or was met before. */
function noteFresh(value: object, run: CopyRun): void {
    const identity = toRaw(value) as object;
    if (identity === run.top || locationNodes.get(identity) !== undefined) {
        run.fresh = false;
        return;
    }
    const first = run.first;
    if (first === undefined) {
        run.first = identity;
        return;
    }
    if (identity === first) {
        run.fresh = false;
        return;
    }
    let seen = run.seen;
    if (seen === undefined) {
        seen = run.seen = new Set();
        seen.add(first);
    }
    const size = seen.size;
    seen.add(identity);
    if (seen.size === size) run.fresh = false;
}

/** One `checkSharedCopies` walk. */
interface CopyWalk {
    run: CopyRun;
    /** Copies beyond the first copy of each object, so far. */
    extra: number;
    /** After `walkCopies`: the depth of the highest ancestor a cycle below returned to. */
    low: number;
    /**
     * Each object met: `-(depth + 2)` while it is on the path from the top,
     * then the copies its subtree makes, or -1 when that count depends on
     * the path (a cycle below it returns to it or above it).
     */
    marks: Map<object, number>;
}

/**
 * Throws when a tree copy of `run.top` (made like `cloneTreeInto`) would make
 * more than `SNAPSHOT_SHARED_COPY_LIMIT` copies beyond the first copy of each
 * object. The copies of a shared subtree are counted once and remembered, so
 * the walk is linear in the distinct objects. An object on a cycle is counted
 * again at each place, with the ancestors it has there; every such visit is
 * an extra copy, and the walk stops as soon as the limit is passed.
 */
function checkSharedCopies(run: CopyRun): void {
    const walk: CopyWalk = { run, extra: 0, low: Infinity, marks: new Map() };
    walkCopies(run.top, 0, walk);
    if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) throw new SnapshotLimitError(walk.extra);
}

/** The copies `entry` makes (0 for a primitive); sets `walk.low`. */
function walkEntry(entry: unknown, depth: number, walk: CopyWalk): number {
    if (entry === null || typeof entry !== 'object') {
        walk.low = Infinity;
        return 0;
    }
    return walkCopies(entry, depth, walk);
}

/** The copies a tree copy of `value` makes; sets `walk.low`. */
function walkCopies(value: object, depth: number, walk: CopyWalk): number {
    const identity = toRaw(value) as object;
    const source: any = readsOf(identity, walk.run);
    const marks = walk.marks;
    const mark = marks.get(identity);
    if (mark !== undefined) {
        if (mark <= -2) {
            // a cycle: the copy reuses the ancestor's copy
            walk.low = -mark - 2;
            return 0;
        }
        walk.low = Infinity;
        if (mark > 0) {
            walk.extra += mark;
            return mark;
        }
        walk.extra++; // met before, counted again here
    }
    if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT || source instanceof Date) {
        if (mark === undefined) marks.set(identity, 1);
        walk.low = Infinity;
        return 1;
    }

    marks.set(identity, -(depth + 2));
    const below = depth + 1;
    let size = 1;
    let low = Infinity;
    if (Array.isArray(source)) {
        for (let i = 0; i < source.length && walk.extra <= SNAPSHOT_SHARED_COPY_LIMIT; i++) {
            size += walkEntry(source[i], below, walk);
            if (walk.low < low) low = walk.low;
        }
    } else if (source instanceof Map) {
        for (const [key, entry] of source) {
            size += walkEntry(key, below, walk);
            if (walk.low < low) low = walk.low;
            size += walkEntry(entry, below, walk);
            if (walk.low < low) low = walk.low;
            if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) break;
        }
    } else if (source instanceof Set) {
        for (const entry of source) {
            size += walkEntry(entry, below, walk);
            if (walk.low < low) low = walk.low;
            if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) break;
        }
    } else {
        for (const key in source) {
            if (!hasOwn.call(source, key)) continue;
            size += walkEntry(source[key], below, walk);
            if (walk.low < low) low = walk.low;
            if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) break;
        }
        const symbolKeys = Object.getOwnPropertySymbols(source);
        for (let i = 0; i < symbolKeys.length; i++) {
            if (!isEnumerable.call(source, symbolKeys[i])) continue;
            size += walkEntry(source[symbolKeys[i]], below, walk);
            if (walk.low < low) low = walk.low;
        }
    }
    // Remember the count only when no cycle below returns to this object or
    // above it. Such an object is on no cycle, so no object below it can be
    // an ancestor of another place of it, and its count is the same at every
    // place. On a cycle, the count depends on which objects are ancestors there.
    marks.set(identity, low > depth ? size : -1);
    walk.low = low;
    return size;
}

// The raw objects on the path from the top of the current clone to here, and
// their copies, so only a cycle (not a shared object) is reused. One stack
// for every call: a call (also one made from a getter during another clone)
// looks only at the entries from its own `base` up.
const cloneAncestors: object[] = [];
const cloneCopies: any[] = [];
const hasOwn = Object.prototype.hasOwnProperty;
const isEnumerable = Object.prototype.propertyIsEnumerable;

function cloneChild(value: any, run: CopyRun): any {
    if (value === null || typeof value !== 'object') return value;
    if (run.fresh) noteFresh(value, run);
    return cloneTreeInto(value, run);
}

function cloneTreeInto(value: any, run: CopyRun): any {
    // identity from the raw target, reads through `value` (see deepClone)
    const identity = toRaw(value) as object;
    if (identity === run.container) value = readsOf(identity, run);
    for (let i = cloneAncestors.length - 1; i >= run.base; i--) {
        if (cloneAncestors[i] === identity) return cloneCopies[i];
    }

    if (--run.countdown === 0) countdownDone(run);
    let copy: any;
    if (Array.isArray(value)) {
        const length = value.length;
        copy = new Array(length);
        cloneAncestors.push(identity);
        cloneCopies.push(copy);
        for (let i = 0; i < length; i++) copy[i] = cloneChild(value[i], run);
    } else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype === Object.prototype) {
            copy = {};
        } else if (value instanceof Date) {
            return new Date(value.getTime());
        } else if (value instanceof Map) {
            copy = new Map();
            cloneAncestors.push(identity);
            cloneCopies.push(copy);
            value.forEach((entry, key) => {
                copy.set(cloneChild(key, run), cloneChild(entry, run));
            });
            cloneAncestors.pop();
            cloneCopies.pop();
            return copy;
        } else if (value instanceof Set) {
            copy = new Set();
            cloneAncestors.push(identity);
            cloneCopies.push(copy);
            value.forEach(entry => {
                copy.add(cloneChild(entry, run));
            });
            cloneAncestors.pop();
            cloneCopies.pop();
            return copy;
        } else {
            copy = Object.create(prototype);
        }
        cloneAncestors.push(identity);
        cloneCopies.push(copy);
        for (const key in value) {
            if (hasOwn.call(value, key)) copy[key] = cloneChild(value[key], run);
        }
        const symbolKeys = Object.getOwnPropertySymbols(value);
        for (let i = 0; i < symbolKeys.length; i++) {
            const symbolKey = symbolKeys[i];
            if (isEnumerable.call(value, symbolKey)) copy[symbolKey] = cloneChild(value[symbolKey], run);
        }
    }
    cloneAncestors.pop();
    cloneCopies.pop();
    return copy;
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
