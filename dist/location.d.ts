import type { EmitFunction, Path, StateEvent } from "./types";
/**
 * Where each wrapped object sits in its state tree.
 *
 * Every raw object that has a proxy has a location node. A node records the
 * places that hold it (a parent node and a key), so a path is read when an
 * event is made, never fixed when the proxy is made. Structural changes move
 * places: `relinkArray` gives array items their new index, `attachValue` and
 * `detachPlace` follow assignments and removals. A node with no place under a
 * root is detached and emits nothing.
 *
 * One object can sit at several places (`list[0] = list[1]`). The wire cannot
 * carry shared identity, so the remote holds copies; a write through the
 * shared object then emits one event per place. Places of such aliases come
 * from the walk that stores a value (root creation, assignment, insertion,
 * array reorders), so they do not depend on what was read before.
 *
 * A place names its parent weakly: a child never keeps a removed parent or
 * an abandoned root alive.
 *
 * An object reachable from two roots emits to one of them (see `locate`).
 */
export declare const enum ContainerKind {
    Plain = 0,
    Map = 1,
    Set = 2
}
export interface LocationRoot {
    emit: EmitFunction | undefined;
    path: Path;
}
export declare class Place {
    private readonly parentRef;
    /** The container node's `id`: compares places without reading the WeakRef. */
    readonly parentId: number;
    /** Property name, array index (number), map key; unused for set members. */
    key: unknown;
    constructor(parent: LocationNode, key: unknown);
    /** The container's node; undefined once the container was collected. */
    get parent(): LocationNode | undefined;
}
export interface LocationNode {
    /** Unique per node, never reused. */
    id: number;
    raw: object;
    kind: ContainerKind;
    places: Place[];
    root: LocationRoot | undefined;
    /** The root this object was first read under; it wins when two roots hold the object. */
    scope: LocationRoot | undefined;
    /** The object's live proxy (its `globalSeen` entry), read without a second map lookup. */
    proxy: object | undefined;
    /** The proxy this object had before it was evicted, to reuse it if the object comes back. */
    evicted: WeakRef<object> | undefined;
    /** The last `relinkArray` call that placed this object (tells repeats apart). */
    relinked: number;
    /**
     * A child's place under this object, or under an object below it, was
     * dropped while this object was detached. Storing it again walks its
     * children to give those places back.
     */
    lostLink: boolean;
}
export declare function getLocationNode(raw: object): LocationNode | undefined;
export declare function ensureLocationNode(raw: object): LocationNode;
/** Where an event goes: one root and every path of the object under it. */
export interface Target {
    root: LocationRoot;
    paths: Path[];
}
/**
 * Where an event about `node` (plus `tail`) goes: every current place of the
 * object, under one root. Undefined when the object is detached or that root
 * has no emit function.
 *
 * An object under two roots (a replica built on raw objects it shares with
 * its source) emits only to its scope, the root it was first read under, so
 * applying an event to the replica cannot echo back to the source.
 *
 * A write that finds no root is counted in `proxyStats.detachedWrites`.
 */
export declare function locate(node: LocationNode, tail?: PropertyKey): Target | undefined;
/** Is the object somewhere under a root (with or without an emit function)? */
export declare function isAttached(node: LocationNode): boolean;
/**
 * Send `event` to every path of `target`. Its payload holds copies already
 * (`copyPayload`, made before the write). Every further path gets copies
 * of those copies, all made before the first emit, so a listener that
 * changes a payload cannot change another, and two remote places never
 * share one object. The first path gets `event` itself.
 */
export declare function dispatch(target: Target, event: StateEvent): void;
/**
 * Replace the payload fields of `event` (live values) with deep copies.
 * `items` and `oldValues` are arrays the wrapper made for this event; each is
 * one payload, copied whole, with one copy limit. A payload too large to copy
 * throws a `SnapshotLimitError` and leaves `event` as it was.
 *
 * With `guard`, the copies are made before the write that changes `guard`:
 * a payload that reaches `guard` would be copied as it is before that write,
 * so then nothing is copied and the result is false (see `writeThenCopy`).
 */
export declare function copyPayload(event: StateEvent | undefined, guard?: object): boolean;
/**
 * Make `write`, a change of `container` alone, then copy the payload of
 * `event`: for a payload that reaches `container` (a cycle through it, or
 * the container itself, as a reorder sends), which `copyPayload` could not
 * copy before the write. A payload too large to copy puts the container's
 * contents back and throws, so the write changes nothing.
 */
export declare function writeThenCopy<R>(container: object, event: StateEvent, write: () => R): R;
/**
 * Record that a proxy read found `raw` at `parent[key]`. Called on every read
 * of a nested object, so the common case (place already known) is one compare.
 */
export declare function notePlace(node: LocationNode, parent: LocationNode, key: unknown): void;
/** `parent[key]` no longer holds `value`. */
export declare function detachPlace(value: object, parent: LocationNode, key: unknown): void;
/** `parent[key]` now holds `value` (a raw object). */
export declare function attachValue(value: object, parent: LocationNode, key: unknown): void;
/**
 * A new root: give places to the objects in its initial value that need
 * them now, which are the aliases (an object at two places) and the
 * containers above them. Other objects get their place when they are read.
 */
export declare function adoptRoot(node: LocationNode): void;
/**
 * After a structural change of `array` (its node `arrayNode`): items from
 * index `from` to the end get their current index, `removed` items lose
 * their place here, and `inserted` items (raw) join the tree.
 */
export declare function relinkArray(arrayNode: LocationNode, array: readonly unknown[], from: number, removed?: readonly unknown[], inserted?: readonly unknown[]): void;
/**
 * After `sort`, `reverse`, `fill` or `copyWithin`: like `relinkArray` from
 * index 0, and an object without a node that now sits at two indexes (an
 * alias the change made) gets a node with both places.
 */
export declare function relinkReorder(arrayNode: LocationNode, array: readonly unknown[], removed: readonly unknown[], inserted?: readonly unknown[]): void;
/**
 * Drop the proxy cache entries of an object that left the tree, and of its
 * children that left with it, so GC can collect them. An object that is
 * still placed under a root (it moved) keeps its proxy.
 */
export declare function evictDeep(value: any, parent?: LocationNode): void;
/** The proxy an evicted object had, if it is still alive; it goes back in the caches. */
export declare function restoreEvicted(node: LocationNode): object | undefined;
