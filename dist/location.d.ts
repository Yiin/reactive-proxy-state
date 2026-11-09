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
    /**
     * The root emits on a later microtask (`{ async: true }`): its events
     * wait, so they also copy what a write removes (see `copyPayload`).
     */
    async: boolean;
    /**
     * Events made under this root and not delivered yet, oldest first, while
     * a write that made several is delivering them (see `deliver`).
     */
    undelivered: Undelivered | undefined;
}
/**
 * A root's queue: `events[next]` is the oldest event not delivered yet. The
 * events of the write that started it have `generation` (see
 * `emitListener`). Listener writes add events of other generations: from
 * index `changeAt` on they have `changeGeneration`, and `marks` holds any
 * later changes, pairs of a first index and its generation. Most queues
 * change at most once, so they allocate no `marks`.
 */
interface Undelivered {
    events: StateEvent[];
    next: number;
    generation: number;
    changeAt: number;
    changeGeneration: number;
    marks: number[] | undefined;
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
    /** In that call: how many of its old places in the array it has not met again yet. */
    relinkedPlaces: number;
    /**
     * A child's place under this object, or under an object below it, was
     * dropped while this object was detached. Storing it again walks its
     * children to give those places back.
     */
    lostLink: boolean;
    /**
     * The object had no own accessor property when its proxy first wrote to
     * it (see `writesThroughSetter`); undefined before that write.
     */
    dataOnly: boolean | undefined;
    /**
     * How many places name this node as their container: every `Place` made
     * with it counts, and each place dropped from its object's `places` stops
     * counting. A place whose object was collected still counts, so the
     * number is never below the places there are (see `relink`).
     */
    childPlaces: number;
    /** The last store walk that met this object (see `enterAdopt`). */
    walk: number;
    /** The last store that put this node on its list of nodes to prune (see `touch`). */
    touched: number;
    /** How many places the node kept at its last full `prunePlaces`. */
    pruned: number;
    /** The places of a node with more than `WIDE` of them, by container and key (see `findPlace`). */
    index: PlaceIndex | undefined;
}
/**
 * The places of one node by container id, then by key when one container
 * holds the object at several keys. It belongs to `places` while that array
 * keeps `length` items; a change of an item in place (a splice, a new key)
 * drops it. A push through `pushPlace` keeps it.
 */
interface PlaceIndex {
    places: Place[];
    length: number;
    byParent: Map<number, Place | Map<unknown, Place>>;
}
export declare function getLocationNode(raw: object): LocationNode | undefined;
export declare function ensureLocationNode(raw: object): LocationNode;
/**
 * Does a write to `prop` of `target` (raw; its node is `node`) call an own
 * setter? Read from the property's descriptor, unless the object had no own
 * accessor when its proxy first wrote to it: a write through a proxy adds
 * only data properties, so then there is none to find, and no descriptor
 * is made per write. An accessor added later (`Object.defineProperty`) is
 * outside the supported input. An object with more than 64 own keys is not
 * scanned and reads the descriptor at every write.
 */
export declare function writesThroughSetter(target: object, prop: PropertyKey, node: LocationNode): boolean;
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
 * (`copyPayload` or `copyPayloadAfter`, made before the write). Every
 * further path gets copies of the stored values (`newValue`, `value`,
 * `items`), all made before the first emit, so a listener that changes one
 * cannot change another, and two remote places never share one object.
 * The first path gets `event` itself. What the write removed is copied per
 * path only where `copyPayload` copied it (a queued event); otherwise every
 * path carries the removed value itself, shared by the events.
 */
export declare function dispatch(target: Target, event: StateEvent): void;
/**
 * Deliver the `events` of one write to `root.emit`, in order, after the
 * events earlier writes left undelivered under this root.
 *
 * A listener can write while it receives an event. That write changed the
 * state after the events still waiting (the other places of an alias, the
 * other indexes of a longer `length`), so its own events go after them in
 * the root's queue, and the delivery already running sends them in turn.
 * So events reach `emit` in the order the state changed, and a listener's
 * write never sends a later event of the queue while that listener still
 * holds an earlier one: 3.0.4 and earlier sent the queue from inside the
 * listener's write, and a replica got a later write before the event that
 * listener held. A write made while nothing waits is delivered at once,
 * inside the listener call that made it.
 *
 * An `emit` that throws does not stop the others: every event in the queue
 * is delivered once, each for a write that already changed the state, then
 * the first error reaches the write that started the delivery.
 */
export declare function deliver(root: LocationRoot, events: StateEvent[]): void;
/** What `copyPayload` did. */
export declare const enum Copied {
    /** Nothing: the payload reaches its container (see `copyPayloadReaching`). */
    Reaches = 0,
    /** Copied the payload. */
    Done = 1,
    /**
     * Copied the payload, and the values it stores (`newValue`, `value`,
     * `items`) are fresh (see `cloneStored`): the place walk of this store
     * would find nothing in them, so `attachValue` and `relinkArray` skip it.
     * The finding holds for this store only; a later store of the same
     * values walks them again.
     */
    Fresh = 2
}
/**
 * Replace the payload fields of `event` (live values) with deep copies, made
 * before the write that changes `container` (raw). `items` and `oldValues`
 * are arrays the wrapper made for this event and only reads; each is one
 * payload, copied whole, with one copy limit, and kept as it is when it
 * holds no object. A payload too large to copy throws a `SnapshotLimitError`
 * and leaves `event` as it was, so the write is never made.
 *
 * What the write stores (`newValue`, `value`, `items`) is always copied: it
 * stays in the tree, where later writes change it, and a replica needs it
 * as it was. What the write removes (`oldValue`, `oldValues`, and the
 * `value` of a `set-delete`) is copied when the event will wait: an async
 * root, an active queue, or several paths for one write. An immediate
 * single-path event sends the removed value itself. Assignment
 * `newValue` copies keep array items only. Reorders keep properties on
 * nested arrays; the other fields keep every array's properties (see `Named`).
 *
 * A payload that reaches `container` would be copied as `container` is
 * before the write. Then nothing is copied and the result is
 * `Copied.Reaches`: the caller makes the write on `shallowCopy(container)`
 * and copies with `copyPayloadReaching`, still before the write.
 *
 * `held` comes from `heldItems` for the store of `newValue`: the place walk
 * of that store skips those items, so the copy does not check freshness.
 */
export declare function copyPayload(event: StateEvent | undefined, target: Target | undefined, container: object, held?: Set<object>): Copied;
/**
 * `copyPayloadAfter` for a write that `copyPayload` refused because its
 * payload reaches `container`. A getter in that payload would be read
 * before the write, and could give another value after it, so an accessor
 * property in it is refused (an `UnsupportedStateError`) without being
 * read. `after` comes from `shallowCopy`, which refuses the container's own.
 */
export declare function copyPayloadReaching(event: StateEvent, target: Target, container: object, after: object): void;
/**
 * Like `copyPayload`, for a payload that reaches `container`: `after` (a
 * `shallowCopy` of `container` with the write made on it) stands in for
 * `container`, so the payload is copied as it will be after the write,
 * before the write. Throws a `SnapshotLimitError` when it is too large to
 * copy; the write is then never made, and nothing needs to be put back.
 */
export declare function copyPayloadAfter(event: StateEvent, target: Target, container: object, after: object): void;
/**
 * A copy of `container` (raw) that holds the same entries, of the same kind
 * and prototype: an array holds the same items, a map the same entries, a
 * set the same members, an object the same own enumerable properties (as
 * data). A write is made on it to copy a payload as it will be after that
 * write (see `copyPayloadReaching`). An own enumerable accessor of an object
 * is refused (an `UnsupportedStateError`) without being read.
 */
export declare function shallowCopy(container: object): any;
/**
 * Record that a proxy read found `raw` at `parent[key]`. Called on every read
 * of a nested object, so the common case (place already known) is one
 * compare, and a wide node finds the place in its index.
 */
export declare function notePlace(node: LocationNode, parent: LocationNode, key: unknown): void;
/** `parent[key]` no longer holds `value`. */
export declare function detachPlace(value: object, parent: LocationNode, key: unknown): void;
/**
 * `heldBefore` for a store of `value` over `replaced`, the value it writes
 * over when its container was in the tree (see `attachedBefore`); undefined
 * when `replaced` has no node. Made before the write, for `copyPayload` and
 * `attachValue`.
 */
export declare function heldItems(value: unknown, replaced: unknown): Set<object> | undefined;
/**
 * `parent[key]` now holds `value` (a raw object). A `fresh` value (the copy
 * this store made found it fresh, see `cloneStored`) has nothing to place.
 * `replaced` is the value the store wrote over, when `parent` was in the
 * tree before the store (see `attachedBefore`), and `held` is
 * `heldItems(value, replaced)`.
 */
export declare function attachValue(value: object, parent: LocationNode, key: unknown, fresh: boolean, replaced?: unknown, held?: Set<object>): void;
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
export declare function relinkArray(arrayNode: LocationNode, array: readonly unknown[], from: number, removed?: readonly unknown[], inserted?: readonly unknown[], insertedFresh?: boolean): void;
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
export {};
