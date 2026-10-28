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
 * shared object then emits one event per place.
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
export interface Place {
    parent: LocationNode;
    /** Property name, array index (number), map key; unused for set members. */
    key: unknown;
}
export interface LocationNode {
    raw: object;
    kind: ContainerKind;
    places: Place[];
    root: LocationRoot | undefined;
    /** The root this object was first read under; it wins when two roots hold the object. */
    scope: LocationRoot | undefined;
    /** The proxy this object had before it was evicted, to reuse it if the object comes back. */
    evicted: WeakRef<object> | undefined;
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
 * An object under two roots (a replica fed by reference from the initial
 * `replace` event shares raw objects with its source) emits only to its
 * scope, the root it was first read under, so applying an event to the
 * replica cannot echo back to the source.
 */
export declare function locate(node: LocationNode, tail?: PropertyKey): Target | undefined;
/** Is the object somewhere under a root (with or without an emit function)? */
export declare function isAttached(node: LocationNode): boolean;
/**
 * Send `event` to every path of `target`. The first path gets `event`
 * itself; each further one gets a copy with its own path and cloned payload,
 * so two remote places never share one object.
 */
export declare function dispatch(target: Target, event: StateEvent): void;
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
 * After a structural change of `array` (its node `arrayNode`): items from
 * index `from` to the end get their current index, `removed` items lose
 * their place here, and `inserted` items (raw) join the tree.
 */
export declare function relinkArray(arrayNode: LocationNode, array: readonly unknown[], from: number, removed?: readonly unknown[], inserted?: readonly unknown[]): void;
/**
 * Drop the proxy cache entries of an object that left the tree, and of its
 * children that left with it, so GC can collect them. An object that is
 * still placed under a root (it moved) keeps its proxy.
 */
export declare function evictDeep(value: any, parent?: LocationNode): void;
/** The proxy an evicted object had, if it is still alive; it goes back in the caches. */
export declare function restoreEvicted(node: LocationNode): object | undefined;
