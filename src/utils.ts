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
 * Which arrays of a payload copy keep their named (non-index) properties.
 * Finding them costs a key list per array, so only the payloads 1.0.44 sent
 * as the value itself keep them: the initial replace, inserted values and
 * what a write removes. A later `newValue` keeps each array's items, as
 * 1.0.44's copy did.
 */
export const enum Named {
    /** No array: its items only. */
    None = 0,
    /** Every array below the top value, an array the library made (`items`, `oldValues`). */
    Below = 1,
    /** Every array. */
    All = 2,
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
export function cloneTree<T>(value: T, named: Named): T {
    return copyTree(value, undefined, undefined, false, named) as T;
}

/** What `cloneTreeUnless` returns for a value that reaches the object it names. */
export const REACHES = Symbol('reaches');

/**
 * `cloneTree(value, named)`, or `REACHES` as soon as the copy (or its
 * measure) meets `container`. A `SnapshotLimitError` thrown first is
 * measured on objects other than `container`.
 */
export function cloneTreeUnless<T>(value: T, container: object, named: Named): T | typeof REACHES {
    return copyUnless(value, container, false, named) as T | typeof REACHES;
}

/**
 * `cloneTreeUnless(value, container, named)` for a value about to be stored
 * (the new value of a write, inserted items, a new root; `container` may be
 * undefined). It also finds whether the value is fresh: no object in it has
 * a location node, and no object sits at two places in it (an alias or a
 * cycle). `copiedFresh` says so when the call returns. The place walk of a
 * store finds nothing to do in a fresh value, so the store skips it (see
 * `attachValue`). The check stops at the first object that is not fresh.
 */
export function cloneStored<T>(value: T, container: object | undefined, named: Named): T | typeof REACHES {
    return copyUnless(value, container, true, named) as T | typeof REACHES;
}

/** Whether the value the last `cloneStored` call copied is fresh; set when it returns. */
export let copiedFresh = false;

function copyUnless(value: unknown, container: object | undefined, checkFresh: boolean, named: Named): unknown {
    try {
        return copyTree(value, container, undefined, checkFresh, named);
    } catch (error) {
        if (error === reachedContainer) {
            copiedFresh = false;
            return REACHES;
        }
        throw error;
    }
}

/**
 * The copy `cloneTree(value, named)` makes once `container` holds what
 * `contents` holds: wherever the copy (and its measure) meets `container`,
 * it reads `contents` instead, a shallow copy of `container` of the same
 * kind. So a payload is copied, or refused, as it will be after a write to
 * `container`, before that write is made.
 */
export function cloneTreeAfter<T>(value: T, container: object, contents: object, named: Named): T {
    return copyTree(value, container, contents, false, named) as T;
}

const reachedContainer = new Error('reactive-proxy-state: internal, a copy reached its container');

function copyTree(
    value: unknown,
    container: object | undefined,
    contents: object | undefined,
    checkFresh: boolean,
    named: Named
): unknown {
    if (value === null || typeof value !== 'object') {
        if (checkFresh) copiedFresh = true;
        return value;
    }
    const top = toRaw(value) as object;
    if (top === value && top !== container) {
        const small = copySmall(value, container, checkFresh, named);
        if (small !== undefined) return small;
    }
    // a copy made from a getter during another copy keeps the outer copy's state
    const base = cloneAncestors.length;
    const workBase = cloneWork.length;
    const outerTop = cloneTop;
    const outerCountdown = cloneCountdown;
    const outerContainer = cloneContainer;
    const outerContents = cloneContents;
    const outerFresh = cloneFresh;
    const outerFirst = cloneFirst;
    const outerSeen = cloneSeen;
    const outerBase = cloneBase;
    const outerIndex = cloneIndex;
    const outerNamed = cloneNamed;
    cloneTop = top;
    cloneCountdown = SNAPSHOT_CHECK_AFTER;
    cloneContainer = container;
    cloneContents = contents;
    cloneFresh = checkFresh && locationNodes.get(top) === undefined;
    cloneFirst = undefined;
    cloneSeen = undefined;
    cloneBase = base;
    cloneIndex = undefined;
    cloneNamed = named;
    try {
        const copy = cloneEntry(value, 0, named);
        if (checkFresh) copiedFresh = cloneFresh;
        return copy;
    } finally {
        cloneAncestors.length = base;
        cloneCopies.length = base;
        cloneWork.length = workBase;
        cloneTop = outerTop;
        cloneCountdown = outerCountdown;
        cloneContainer = outerContainer;
        cloneContents = outerContents;
        cloneFresh = outerFresh;
        cloneFirst = outerFirst;
        cloneSeen = outerSeen;
        cloneBase = outerBase;
        cloneIndex = outerIndex;
        cloneNamed = outerNamed;
    }
}

// The current copy: its value (raw), how many copies it may still make
// before it measures that value (see `checkSharedCopies`), the container it
// stops at (see `cloneTreeUnless`) or reads `cloneContents` for (see
// `cloneTreeAfter`), and, for `cloneStored`, whether every object met so far
// is fresh, with the first object met below the top, then all of them.
// `cloneNamed`: which arrays keep their named properties (see `Named`); the
// copy passes it along, the limit measure and the deep fills read it here.
let cloneTop: object | undefined;
let cloneCountdown = 0;
let cloneContainer: object | undefined;
let cloneContents: object | undefined;
let cloneFresh = false;
let cloneFirst: object | undefined;
let cloneSeen: Set<object> | undefined;
let cloneNamed = Named.None;

/**
 * The copy of a small raw value, made without the stack and the counter of
 * a tree copy: a leaf (a plain object of primitives), or an array of at
 * most 8 entries that are primitives or leaves. Such a value holds no
 * cycle, only the repeats checked here, and is far below the copy limit.
 * Undefined for any other value, which takes the full copy, for an array
 * that holds `container` (the copy must read or refuse it, see `readsOf`),
 * and for an array with named properties `named` keeps. With `checkFresh`
 * (see `cloneStored`), sets `copiedFresh`.
 */
function copySmall(
    value: object,
    container: object | undefined,
    checkFresh: boolean,
    named: Named
): object | undefined {
    if (!Array.isArray(value)) {
        const copy = copyLeaf(value);
        if (copy !== undefined && checkFresh) copiedFresh = locationNodes.get(value) === undefined;
        return copy;
    }
    const length = value.length;
    if (length > 8) return undefined;
    if (named === Named.All && namedKeys(value) !== undefined) return undefined;
    const copy = new Array(length);
    let fresh = checkFresh && locationNodes.get(value) === undefined;
    for (let i = 0; i < length; i++) {
        const item = value[i];
        if (item === null || typeof item !== 'object') {
            if (item !== undefined || i in value) copy[i] = item; // a hole stays a hole
            continue;
        }
        if (item === container || toRaw(item) !== item) return undefined;
        const leaf = copyLeaf(item);
        if (leaf === undefined) return undefined;
        copy[i] = leaf;
        if (fresh) fresh = locationNodes.get(item) === undefined && value.indexOf(item) === i;
    }
    if (checkFresh) copiedFresh = fresh;
    return copy;
}

/** The copy of `value` when it is a plain object whose own entries are all primitives; else undefined. */
function copyLeaf(value: object): object | undefined {
    if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const copy: any = {};
    for (const key in value) {
        if (!hasOwn.call(value, key)) continue;
        const entry = (value as any)[key];
        if (entry !== null && typeof entry === 'object') return undefined;
        if (key === '__proto__') setData(copy, key, entry);
        else copy[key] = entry;
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) return undefined;
    return copy;
}

/** What the copy reads for `identity` (a raw object): `cloneContents` in place of `cloneContainer`. */
function readsOf(identity: object): object {
    if (identity !== cloneContainer) return identity;
    if (cloneContents === undefined) throw reachedContainer;
    return cloneContents;
}

/**
 * Count one copy. At `SNAPSHOT_CHECK_AFTER` copies: while the copy is fresh,
 * every copy so far was the first copy of its object, so none was extra,
 * and it counts again; otherwise it measures the whole value, once.
 */
function countCopy(): void {
    if (--cloneCountdown === 0) {
        if (cloneFresh) cloneCountdown = SNAPSHOT_CHECK_AFTER;
        else checkSharedCopies(cloneTop!);
    }
}

/** The copy stays fresh unless `identity` (raw), met below its top, has a location node or was met before. */
function noteFresh(identity: object): void {
    if (identity === cloneTop || locationNodes.get(identity) !== undefined) {
        cloneFresh = false;
        return;
    }
    const first = cloneFirst;
    if (first === undefined) {
        cloneFirst = identity;
        return;
    }
    if (identity === first) {
        cloneFresh = false;
        return;
    }
    let seen = cloneSeen;
    if (seen === undefined) {
        seen = cloneSeen = new Set();
        seen.add(first);
    }
    const size = seen.size;
    seen.add(identity);
    if (seen.size === size) cloneFresh = false;
}

/**
 * The own enumerable keys of `array` that are not array indexes ("extra",
 * "-1", "01"), or undefined when it has none. Indexes come first in key
 * order, so the named keys are the ones after the last index.
 */
export function namedKeys(array: object): (string | symbol)[] | undefined {
    const keys = Object.keys(array);
    let start = keys.length;
    while (start > 0 && !isIndexKey(keys[start - 1])) start--;
    const symbols = Object.getOwnPropertySymbols(array);
    let names: (string | symbol)[] | undefined = start === keys.length ? undefined : keys.slice(start);
    for (let i = 0; i < symbols.length; i++) {
        if (isEnumerable.call(array, symbols[i])) (names ??= []).push(symbols[i]);
    }
    return names;
}

/** Is `key` an array index: "0", or digits without a leading zero, below 2^32 - 1? */
function isIndexKey(key: string): boolean {
    const length = key.length;
    if (length === 0 || length > 10) return false;
    const first = key.charCodeAt(0);
    if (first < 48 || first > 57 || (first === 48 && length > 1)) return false;
    for (let i = 1; i < length; i++) {
        const code = key.charCodeAt(i);
        if (code < 48 || code > 57) return false;
    }
    return length < 10 || Number(key) < 4294967295;
}

/** `object[key] = value` as an own enumerable data property: no setter runs, and `__proto__` stays a key. */
export function setData(object: object, key: PropertyKey, value: unknown): void {
    Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}

/** One `checkSharedCopies` walk. */
interface CopyWalk {
    /** Copies beyond the first copy of each object, so far. */
    extra: number;
    /** After an object's walk: the depth of the highest ancestor a cycle below returned to. */
    low: number;
    /**
     * Each object met: `-(depth + 2)` while it is on the path from the top,
     * then the copies its subtree makes, or -1 when that count depends on
     * the path (a cycle below it returns to it or above it).
     */
    marks: Map<object, number>;
}

/** An object `walkCopies` is in: its entries, the next one, and what they add up to so far. */
interface CopyFrame {
    identity: object;
    depth: number;
    entries: readonly unknown[];
    next: number;
    size: number;
    low: number;
}

/**
 * Throws when a tree copy of `value` (made like `copyTree`) would make
 * more than `SNAPSHOT_SHARED_COPY_LIMIT` copies beyond the first copy of each
 * object. The copies of a shared subtree are counted once and remembered, so
 * the walk is linear in the distinct objects. An object on a cycle is counted
 * again at each place, with the ancestors it has there; every such visit is
 * an extra copy, and the walk stops as soon as the limit is passed.
 */
function checkSharedCopies(value: object): void {
    const walk: CopyWalk = { extra: 0, low: Infinity, marks: new Map() };
    walkCopies(value, walk);
    if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) throw new SnapshotLimitError(walk.extra);
}

/** The copies a tree copy of `top` makes, walked with a stack of frames, not of calls. */
function walkCopies(top: object, walk: CopyWalk): void {
    const frames: CopyFrame[] = [];
    enterCopies(top, 0, walk, frames);
    while (frames.length > 0) {
        const frame = frames[frames.length - 1];
        if (frame.next < frame.entries.length && walk.extra <= SNAPSHOT_SHARED_COPY_LIMIT) {
            const entry = frame.entries[frame.next++];
            if (entry === null || typeof entry !== 'object') {
                walk.low = Infinity;
                continue;
            }
            const size = enterCopies(entry, frame.depth + 1, walk, frames);
            if (frames[frames.length - 1] !== frame) continue; // its frame adds up when it ends
            frame.size += size;
            if (walk.low < frame.low) frame.low = walk.low;
            continue;
        }
        frames.pop();
        // Remember the count only when no cycle below returns to this object or
        // above it. Such an object is on no cycle, so no object below it can be
        // an ancestor of another place of it, and its count is the same at every
        // place. On a cycle, the count depends on which objects are ancestors there.
        walk.marks.set(frame.identity, frame.low > frame.depth ? frame.size : -1);
        walk.low = frame.low;
        const below = frames[frames.length - 1];
        if (below !== undefined) {
            below.size += frame.size;
            if (frame.low < below.low) below.low = frame.low;
        }
    }
}

/**
 * Meet `value` at `depth`: the copies it makes when they are known (and
 * `walk.low`), else 0 with a frame pushed for its entries.
 */
function enterCopies(value: object, depth: number, walk: CopyWalk, frames: CopyFrame[]): number {
    const identity = toRaw(value) as object;
    const source: any = identity === cloneContainer ? readsOf(identity) : identity;
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
    if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) {
        if (mark === undefined) marks.set(identity, 1);
        walk.low = Infinity;
        return 1;
    }
    marks.set(identity, -(depth + 2));
    frames.push({ identity, depth, entries: entriesOf(source, identity), next: 0, size: 1, low: Infinity });
    return 0;
}

/** What a copy of `source` (the raw object `identity`, or what is read for it) copies below it, in order. */
function entriesOf(source: any, identity: object): readonly unknown[] {
    if (Array.isArray(source)) {
        const names = keepsNamed(cloneNamed, identity === cloneTop ? 0 : 1) ? namedKeys(source) : undefined;
        if (names === undefined) return source;
        const entries: unknown[] = source.slice();
        for (let i = 0; i < names.length; i++) entries.push((source as any)[names[i]]);
        return entries;
    }
    const entries: unknown[] = [];
    if (source instanceof Map) {
        for (const [key, entry] of source) entries.push(key, entry);
    } else if (source instanceof Set) {
        for (const entry of source) entries.push(entry);
    }
    for (const key in source) if (hasOwn.call(source, key)) entries.push(source[key]);
    const symbolKeys = Object.getOwnPropertySymbols(source);
    for (let i = 0; i < symbolKeys.length; i++) {
        if (isEnumerable.call(source, symbolKeys[i])) entries.push(source[symbolKeys[i]]);
    }
    return entries;
}

// The raw objects on the path from the top of the current copy to the object
// being filled, and their copies, so only a cycle (not a shared object) is
// reused. One stack for every call: a copy (also one made from a getter
// during another copy) looks only at the entries from its own `cloneBase`
// up. An object at depth d (the top is at 0) is copied with its d ancestors
// on the path, so the path is d entries long there. A path longer than
// `DEEP_PATH` entries is also kept in `cloneIndex`, which exists only then:
// a deep copy finds its cycles in one lookup, and a shallow one, which
// scans its few ancestors, never reads `cloneIndex` (a read per object costs
// a shallow copy about a tenth of its time).
const cloneAncestors: object[] = [];
const cloneCopies: any[] = [];
let cloneBase = 0;
let cloneIndex: Map<object, any> | undefined;
const DEEP_PATH = 64;
// The copies left to fill below `FILL_DEPTH`, five entries each: their kind,
// what the copy reads, its raw object, its copy, and the path length of its
// parent (see `fillWaiting`).
const cloneWork: any[] = [];
/** Levels a copy fills with one call each; deeper levels wait in `cloneWork`. */
const FILL_DEPTH = 256;
const hasOwn = Object.prototype.hasOwnProperty;
const isEnumerable = Object.prototype.propertyIsEnumerable;

/** What a copy is filled with. */
const enum Fill {
    Object,
    Array,
    Map,
    Set,
}

/** Put `identity` (raw), at `depth`, and its copy at the end of the path. */
function enterPath(identity: object, copy: any, depth: number): void {
    cloneAncestors.push(identity);
    cloneCopies.push(copy);
    if (depth < DEEP_PATH) return;
    // the path is longer than DEEP_PATH now
    if (cloneIndex !== undefined) {
        cloneIndex.set(identity, copy);
        return;
    }
    cloneIndex = new Map();
    for (let i = cloneBase; i < cloneAncestors.length; i++) cloneIndex.set(cloneAncestors[i], cloneCopies[i]);
}

/** Cut the path back to `length` entries. */
function leavePath(length: number): void {
    const ancestors = cloneAncestors;
    const index = cloneIndex;
    while (ancestors.length > length) {
        const identity = ancestors.pop()!;
        cloneCopies.pop();
        if (index !== undefined) index.delete(identity);
    }
    if (index !== undefined && length - cloneBase <= DEEP_PATH) cloneIndex = undefined;
}

/** The copy of `value` at `depth` below the top of the copy (see `cloneEntry`). */
function cloneValue(value: unknown, depth: number, named: Named): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (cloneFresh) noteFresh(toRaw(value) as object);
    return cloneEntry(value, depth, named);
}

/** Does an array at `depth` keep its named properties in a copy made with `named`? */
function keepsNamed(named: Named, depth: number): boolean {
    return named === Named.All || (named === Named.Below && depth > 0);
}

/**
 * The copy of `value` (an object) at `depth` below the top of the copy: the
 * copy of the ancestor it is, on a cycle, else a new copy. Its identity is
 * the raw target and its reads go through `value` (see deepClone). The new
 * copy is filled now when `depth` is below `FILL_DEPTH`, else it waits in
 * `cloneWork` for the object at the last such depth (see `fillWaiting`).
 */
function cloneEntry(value: any, depth: number, named: Named): any {
    const identity = toRaw(value) as object;
    if (identity === cloneContainer) value = readsOf(identity);
    if (depth > DEEP_PATH) {
        const ancestor = cloneIndex!.get(identity);
        if (ancestor !== undefined) return ancestor;
    } else {
        const ancestors = cloneAncestors;
        for (let i = ancestors.length - 1, stop = ancestors.length - depth; i >= stop; i--) {
            if (ancestors[i] === identity) return cloneCopies[i];
        }
    }

    countCopy();
    let copy: any;
    let kind: Fill;
    if (Array.isArray(value)) {
        copy = new Array(value.length);
        kind = Fill.Array;
    } else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype === Object.prototype) {
            copy = {};
            kind = Fill.Object;
        } else if (value instanceof Date) {
            copy = new Date(value.getTime());
            kind = Fill.Object;
        } else if (value instanceof Map) {
            copy = new Map();
            kind = Fill.Map;
        } else if (value instanceof Set) {
            copy = new Set();
            kind = Fill.Set;
        } else {
            copy = Object.create(prototype);
            kind = Fill.Object;
        }
    }
    if (depth >= FILL_DEPTH - 1) {
        cloneDeep(kind, value, identity, copy, depth, named);
        return copy;
    }
    // Plain objects and arrays are filled here, not in `fillObject` and
    // `fillArray`, which do the same for deep copies: a call less per object
    // is most of a shallow copy's cost.
    const below = depth + 1;
    let pushed = false;
    if (kind === Fill.Object) {
        for (const key in value) {
            if (!hasOwn.call(value, key)) continue;
            let child = value[key];
            if (child !== null && typeof child === 'object') {
                if (!pushed) {
                    pushed = true;
                    enterPath(identity, copy, depth);
                }
                if (cloneFresh) noteFresh(toRaw(child) as object);
                child = cloneEntry(child, below, named);
            }
            if (key === '__proto__') setData(copy, key, child);
            else copy[key] = child;
        }
        const symbolKeys = Object.getOwnPropertySymbols(value);
        if (symbolKeys.length !== 0) pushed = fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed);
    } else if (kind === Fill.Array) {
        const length = copy.length;
        for (let i = 0; i < length; i++) {
            const child = value[i];
            if (child === null || typeof child !== 'object') {
                if (child !== undefined || i in value) copy[i] = child; // a hole stays a hole
                continue;
            }
            if (!pushed) {
                pushed = true;
                enterPath(identity, copy, depth);
            }
            if (cloneFresh) noteFresh(toRaw(child) as object);
            copy[i] = cloneEntry(child, below, named);
        }
        if (keepsNamed(named, depth)) pushed = fillNamed(value, identity, copy, depth, named, pushed);
    } else {
        pushed =
            kind === Fill.Map ? fillMap(value, identity, copy, depth, named) : fillSet(value, identity, copy, depth, named);
    }
    if (pushed) {
        // the children took themselves off the path: only this object is left
        if (depth < DEEP_PATH) {
            cloneAncestors.pop();
            cloneCopies.pop();
        } else {
            leavePath(cloneAncestors.length - 1);
        }
    }
    return copy;
}

/**
 * `cloneEntry` from depth `FILL_DEPTH - 1` on: the copy at that depth is
 * filled now and fills the copies waiting below it (see `fillWaiting`); a
 * deeper copy waits in `cloneWork`.
 */
function cloneDeep(kind: Fill, value: any, identity: object, copy: any, depth: number, named: Named): void {
    const pathLength = cloneAncestors.length;
    if (depth >= FILL_DEPTH) {
        cloneWork.push(kind, value, identity, copy, pathLength);
        return;
    }
    const workBase = cloneWork.length;
    fill(kind, value, identity, copy, depth, named);
    fillWaiting(workBase);
    leavePath(pathLength);
}

function fill(kind: Fill, value: any, identity: object, copy: any, depth: number, named: Named): void {
    if (kind === Fill.Object) fillObject(value, identity, copy, depth, named);
    else if (kind === Fill.Array) fillArray(value, identity, copy, depth, named);
    else if (kind === Fill.Map) fillMap(value, identity, copy, depth, named);
    else fillSet(value, identity, copy, depth, named);
}

/**
 * Fill the copies waiting in `cloneWork` above `workBase`: those the object
 * at depth `FILL_DEPTH - 1` left, and the ones they leave in turn, last
 * first. Each starts with the path cut back to its parent's, which the
 * copies filled before it left in place, so each finds its own ancestors,
 * and no call stack grows with the depth.
 */
function fillWaiting(workBase: number): void {
    const work = cloneWork;
    while (work.length > workBase) {
        const at = work.length - 5;
        const kind: Fill = work[at];
        const value = work[at + 1];
        const identity = work[at + 2];
        const copy = work[at + 3];
        const pathLength: number = work[at + 4];
        work.length = at;
        if (cloneAncestors.length !== pathLength) leavePath(pathLength);
        fill(kind, value, identity, copy, FILL_DEPTH, cloneNamed);
    }
}

// The fills below copy the entries of `value` (raw object `identity`, at
// `depth`) into `copy`, and say whether they put the object on the ancestor
// path. It goes there before its first object child, the only kind that can
// meet it again: a leaf never goes on it. The caller takes it off afterwards.
// `cloneEntry` fills shallow plain objects and arrays itself, the way
// `fillObject` and `fillArray` do; keep the two the same.

function fillObject(value: any, identity: object, copy: any, depth: number, named: Named): boolean {
    const below = depth + 1;
    let pushed = false;
    for (const key in value) {
        if (!hasOwn.call(value, key)) continue;
        let child = value[key];
        if (child !== null && typeof child === 'object') {
            if (!pushed) {
                pushed = true;
                enterPath(identity, copy, depth);
            }
            if (cloneFresh) noteFresh(toRaw(child) as object);
            child = cloneEntry(child, below, named);
        }
        if (key === '__proto__') setData(copy, key, child);
        else copy[key] = child;
    }
    const symbolKeys = Object.getOwnPropertySymbols(value);
    return symbolKeys.length === 0 ? pushed : fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed);
}

/** The enumerable symbol properties of an object (see `fillObject`). */
function fillSymbols(
    value: any,
    identity: object,
    copy: any,
    depth: number,
    named: Named,
    symbolKeys: symbol[],
    pushed: boolean
): boolean {
    const below = depth + 1;
    for (let i = 0; i < symbolKeys.length; i++) {
        const symbolKey = symbolKeys[i];
        if (!isEnumerable.call(value, symbolKey)) continue;
        const child = value[symbolKey];
        if (child !== null && typeof child === 'object' && !pushed) {
            pushed = true;
            enterPath(identity, copy, depth);
        }
        copy[symbolKey] = cloneValue(child, below, named);
    }
    return pushed;
}

function fillArray(value: any, identity: object, copy: any[], depth: number, named: Named): boolean {
    const below = depth + 1;
    let pushed = false;
    const length = copy.length;
    for (let i = 0; i < length; i++) {
        const child = value[i];
        if (child === null || typeof child !== 'object') {
            if (child !== undefined || i in value) copy[i] = child; // a hole stays a hole
            continue;
        }
        if (!pushed) {
            pushed = true;
            enterPath(identity, copy, depth);
        }
        if (cloneFresh) noteFresh(toRaw(child) as object);
        copy[i] = cloneEntry(child, below, named);
    }
    return keepsNamed(named, depth) ? fillNamed(value, identity, copy, depth, named, pushed) : pushed;
}

/** The named properties of an array the copy keeps (see `Named`, `fillArray`). */
function fillNamed(value: any, identity: object, copy: any, depth: number, named: Named, pushed: boolean): boolean {
    const names = namedKeys(value);
    if (names === undefined) return pushed;
    const below = depth + 1;
    for (let i = 0; i < names.length; i++) {
        const child = value[names[i]];
        if (child !== null && typeof child === 'object' && !pushed) {
            pushed = true;
            enterPath(identity, copy, depth);
        }
        setData(copy, names[i], cloneValue(child, below, named));
    }
    return pushed;
}

function fillMap(value: any, identity: object, copy: Map<unknown, unknown>, depth: number, named: Named): boolean {
    const below = depth + 1;
    enterPath(identity, copy, depth);
    value.forEach((entry: unknown, key: unknown) => {
        const keyCopy = cloneValue(key, below, named);
        if (key !== null && typeof key === "object") keepCollectionIdentity(key, keyCopy);
        copy.set(keyCopy, cloneValue(entry, below, named));
    });
    fillCollectionProperties(value, copy, below, named);
    return true;
}

function fillSet(value: any, identity: object, copy: Set<unknown>, depth: number, named: Named): boolean {
    const below = depth + 1;
    enterPath(identity, copy, depth);
    value.forEach((entry: unknown) => {
        const entryCopy = cloneValue(entry, below, named);
        if (entry !== null && typeof entry === "object") keepCollectionIdentity(entry, entryCopy);
        copy.add(entryCopy);
    });
    fillCollectionProperties(value, copy, below, named);
    return true;
}

function fillCollectionProperties(value: any, copy: object, depth: number, named: Named): void {
    for (const key in value) {
        if (hasOwn.call(value, key)) setData(copy, key, cloneValue(value[key], depth, named));
    }
    const symbols = Object.getOwnPropertySymbols(value);
    for (let i = 0; i < symbols.length; i++) {
        if (isEnumerable.call(value, symbols[i])) setData(copy, symbols[i], cloneValue(value[symbols[i]], depth, named));
    }
}

// Only collection members need identity across separate payload copies.
// Tokens do not retain the source object. Weak keys release removed copies.
const collectionIdentityKey = Symbol.for('@yiin/reactive-proxy-state.collection-identities');
const collectionIdentities: WeakMap<object, object> =
    Reflect.get(globalThis, collectionIdentityKey) ?? new WeakMap<object, object>();
if (!Reflect.has(globalThis, collectionIdentityKey)) {
    Object.defineProperty(globalThis, collectionIdentityKey, { value: collectionIdentities });
}

export function keepCollectionIdentity(source: unknown, copy: unknown): void {
    if (source === null || typeof source !== 'object' || copy === null || typeof copy !== 'object') return;
    const raw = toRaw(source) as object;
    let identity = collectionIdentities.get(raw);
    if (identity === undefined) {
        identity = {};
        collectionIdentities.set(raw, identity);
    }
    collectionIdentities.set(copy, identity);
}

/** The member this replica holds for a source key or member, without comparing its contents. */
export function collectionMember(collection: Map<unknown, unknown> | Set<unknown>, member: unknown): unknown {
    collection = toRaw(collection);
    if (member === null || typeof member !== 'object' || collection.has(member)) return member;
    const identity = collectionIdentities.get(toRaw(member) as object);
    if (identity === undefined) return member;
    for (const candidate of collection.keys()) {
        if (candidate !== null && typeof candidate === 'object' &&
            collectionIdentities.get(toRaw(candidate) as object) === identity) return candidate;
    }
    return member;
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
