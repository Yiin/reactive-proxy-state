import { ReactiveFlags } from "./constants";
import type { EmitFunction, Path, StateEvent } from "./types";
import { cloneTree, globalSeen, wrapperCache, proxyStats, toRaw } from "./utils";

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

export const enum ContainerKind {
  Plain = 0,
  Map = 1,
  Set = 2,
}

export interface LocationRoot {
  emit: EmitFunction | undefined;
  path: Path;
}

export class Place {
  private readonly parentRef: WeakRef<LocationNode>;
  /** The container node's `id`: compares places without reading the WeakRef. */
  readonly parentId: number;
  /** Property name, array index (number), map key; unused for set members. */
  key: unknown;

  constructor(parent: LocationNode, key: unknown) {
    this.parentRef = new WeakRef(parent);
    this.parentId = parent.id;
    this.key = key;
  }

  /** The container's node; undefined once the container was collected. */
  get parent(): LocationNode | undefined {
    return this.parentRef.deref();
  }
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

const nodes = new WeakMap<object, LocationNode>();
let nodeCount = 0;
// A longer chain of single places is resolved by the general walk, which
// guards against cycles.
const FAST_CHAIN_LIMIT = 256;

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

export function getLocationNode(raw: object): LocationNode | undefined {
  return nodes.get(raw);
}

export function ensureLocationNode(raw: object): LocationNode {
  let node = nodes.get(raw);
  if (node === undefined) {
    node = {
      id: ++nodeCount,
      raw,
      kind:
        raw instanceof Map
          ? ContainerKind.Map
          : raw instanceof Set
            ? ContainerKind.Set
            : ContainerKind.Plain,
      places: [],
      root: undefined,
      scope: undefined,
      proxy: undefined,
      evicted: undefined,
      relinked: 0,
      lostLink: false,
    };
    nodes.set(raw, node);
  }
  return node;
}

/**
 * Does `parent` (the place's container, if it is still alive) still hold
 * `raw` at the place? A raw write outside the proxies can break it.
 */
function holdsIn(parent: LocationNode | undefined, key: unknown, raw: object): parent is LocationNode {
  if (parent === undefined) return false;
  const container = parent.raw as any;
  switch (parent.kind) {
    case ContainerKind.Map:
      return container.get(key) === raw;
    case ContainerKind.Set:
      return container.has(raw);
    default:
      return container[key as PropertyKey] === raw;
  }
}

function holds(place: Place, raw: object): boolean {
  return holdsIn(place.parent, place.key, raw);
}

function segment(parent: LocationNode, key: unknown, raw: object): string {
  if (parent.kind === ContainerKind.Set) {
    // set members have no key; their path segment is their current position
    let index = 0;
    for (const member of parent.raw as Set<unknown>) {
      if (member === raw) break;
      index++;
    }
    return String(index);
  }
  return String(key);
}

function samePlace(place: Place, parent: LocationNode, key: unknown): boolean {
  return place.parentId === parent.id && (parent.kind === ContainerKind.Set || place.key === key);
}

/** Where an event goes: one root and every path of the object under it. */
export interface Target {
  root: LocationRoot;
  paths: Path[];
}

interface Found {
  root: LocationRoot;
  path: Path;
}

/**
 * The fast path of the lookup: one chain of single places up to one root.
 * Returns that root and the one path (plus `tail`), null when the chain
 * ends detached, or undefined when the general walk must decide (several
 * places, a root that is also placed, or a long chain). Places that no
 * longer hold the object are dropped on the way.
 */
function chain(node: LocationNode, tail: PropertyKey | undefined): Target | null | undefined {
  let reversed: string[] | undefined;
  let current = node;
  for (let steps = 0; steps < FAST_CHAIN_LIMIT; steps++) {
    const places = current.places;
    const root = current.root;
    if (root !== undefined) {
      if (places.length !== 0) return undefined;
      return { root, paths: [buildPath(root.path, reversed, tail)] };
    }
    if (places.length !== 1) return places.length === 0 ? null : undefined;
    const place = places[0];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, current.raw)) {
      places.length = 0;
      return null;
    }
    (reversed ??= []).push(segment(parent, place.key, current.raw));
    current = parent;
  }
  return undefined;
}

/**
 * Every root path of `node`, plus `tail` when given, by the general walk.
 * Places that no longer hold the object are dropped on the way. With
 * `firstOnly`, stops at the first path found.
 */
function findAll(node: LocationNode, tail: PropertyKey | undefined, firstOnly: boolean): Found[] {
  const out: Found[] = [];
  collect(node, tail === undefined ? [] : [String(tail)], new Set(), out, firstOnly);
  return out;
}

function buildPath(base: Path, reversed: string[] | undefined, tail: PropertyKey | undefined): Path {
  const middle = reversed === undefined ? 0 : reversed.length;
  const path: Path = new Array(base.length + middle + (tail === undefined ? 0 : 1));
  let index = 0;
  for (let i = 0; i < base.length; i++) path[index++] = base[i];
  for (let i = middle - 1; i >= 0; i--) path[index++] = reversed![i];
  if (tail !== undefined) path[index] = String(tail);
  return path;
}

function collect(
  node: LocationNode,
  suffix: string[],
  visiting: Set<LocationNode>,
  out: Found[],
  firstOnly: boolean
): void {
  if (visiting.has(node)) return;
  visiting.add(node);
  const root = node.root;
  if (root !== undefined) {
    out.push({ root, path: [...root.path, ...suffix] });
  }
  const places = node.places;
  let stale = false;
  for (let i = 0; i < places.length && !(firstOnly && out.length > 0); i++) {
    const place = places[i];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, node.raw)) {
      stale = true;
      continue;
    }
    collect(parent, [segment(parent, place.key, node.raw), ...suffix], visiting, out, firstOnly);
  }
  if (stale) node.places = places.filter((place) => holds(place, node.raw));
  visiting.delete(node);
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
export function locate(node: LocationNode, tail?: PropertyKey): Target | undefined {
  const single = chain(node, tail);
  if (single !== undefined) {
    if (single === null) {
      proxyStats.detachedWrites++;
      return undefined;
    }
    return single.root.emit === undefined ? undefined : single;
  }
  const found = findAll(node, tail, false);
  if (found.length === 0) {
    proxyStats.detachedWrites++;
    return undefined;
  }
  let root = found[0].root;
  for (let i = 1; i < found.length; i++) {
    if (found[i].root !== root) {
      if (node.scope !== undefined && found.some((entry) => entry.root === node.scope)) {
        root = node.scope;
      }
      break;
    }
  }
  if (root.emit === undefined) return undefined;
  const paths: Path[] = [];
  for (let i = 0; i < found.length; i++) {
    if (found[i].root === root) paths.push(found[i].path);
  }
  return { root, paths };
}

/** Is the object somewhere under a root (with or without an emit function)? */
export function isAttached(node: LocationNode): boolean {
  const single = chain(node, undefined);
  if (single !== undefined) return single !== null;
  return findAll(node, undefined, true).length > 0;
}

/**
 * Send `event` to every path of `target`. `event` carries live values; each
 * path gets its own deep copy of them, made now, so a later write cannot
 * change an event that waits in a queue, and two remote places never share
 * one object. The first path gets `event` itself.
 */
export function dispatch(target: Target, event: StateEvent): void {
  const { root, paths } = target;
  const emit = root.emit!;
  const live = paths.length > 1 ? { ...event } : event;
  for (let i = 0; i < paths.length; i++) {
    const copy = i === 0 ? event : { ...live };
    copy.path = paths[i];
    snapshotPayload(copy, live);
    emit(copy);
  }
}

/**
 * Replace the payload fields of `event` with deep copies of the ones in
 * `live`. `items` is an array the wrapper made for this event and uses no
 * more, so when `event` is `live` its objects are copied in place.
 */
function snapshotPayload(event: StateEvent, live: StateEvent): void {
  if (isObject(live.newValue)) event.newValue = cloneTree(live.newValue);
  if (isObject(live.oldValue)) event.oldValue = cloneTree(live.oldValue);
  if (isObject(live.value)) event.value = cloneTree(live.value);
  const items = live.items;
  if (items !== undefined) {
    if (event === live) {
      for (let i = 0; i < items.length; i++) {
        if (isObject(items[i])) items[i] = cloneTree(items[i]);
      }
    } else {
      event.items = cloneTree(items);
    }
  }
  if (live.oldValues !== undefined) event.oldValues = cloneTree(live.oldValues);
}

/** Add a place unless it is already known. Returns true when it was new. */
function addPlace(node: LocationNode, parent: LocationNode, key: unknown): boolean {
  const places = node.places;
  for (let i = 0; i < places.length; i++) {
    if (samePlace(places[i], parent, key)) return false;
  }
  places.push(new Place(parent, key));
  return true;
}

/**
 * Drop places that no longer hold the object. If some places are under a
 * root, also drop the ones under detached parents: the object moved, and
 * every write would walk the dead ends. Such a parent is marked, so storing
 * it again gives the place back (see `lostLink`).
 */
function prunePlaces(node: LocationNode): void {
  let places = node.places.filter((place) => holds(place, node.raw));
  if (places.length > 1) {
    const live = places.filter((place) => isAttached(place.parent!));
    if (live.length > 0 && live.length < places.length) {
      for (let i = 0; i < places.length; i++) {
        if (!live.includes(places[i])) markLostLink(places[i].parent!);
      }
      places = live;
    }
  }
  node.places = places;
}

/** `node` lost a child's place; it and every container above it relink on their next store. */
function markLostLink(node: LocationNode): void {
  if (node.lostLink) return;
  node.lostLink = true;
  const places = node.places;
  for (let i = 0; i < places.length; i++) {
    const parent = places[i].parent;
    if (parent !== undefined) markLostLink(parent);
  }
}

/**
 * Record that a proxy read found `raw` at `parent[key]`. Called on every read
 * of a nested object, so the common case (place already known) is one compare.
 */
export function notePlace(node: LocationNode, parent: LocationNode, key: unknown): void {
  const places = node.places;
  if (places.length === 1 && samePlace(places[0], parent, key)) return;
  if (addPlace(node, parent, key) && node.places.length > 1) prunePlaces(node);
}

/** `parent[key]` no longer holds `value`. */
export function detachPlace(value: object, parent: LocationNode, key: unknown): void {
  const node = nodes.get(value);
  if (node === undefined) return;
  const places = node.places;
  for (let i = 0; i < places.length; i++) {
    if (samePlace(places[i], parent, key)) {
      places.splice(i, 1);
      return;
    }
  }
}

/**
 * One walk over values that were just stored. It gives a place to every
 * object inside them that has a node, and stops at those objects: their own
 * children still hold their places under them, unless the object lost one
 * (`lostLink`), and then it walks on. Containers on the way get nodes only
 * when something inside them has one.
 *
 * An object met twice is an alias (or a cycle). The first walk only notes
 * it; a second walk then gives each such object a node at its first visit,
 * so every later visit records its place.
 */
interface Walk {
  touched: LocationNode[];
  seen: Set<object>;
  /** Objects without a node the walk met more than once. */
  repeated: Set<object> | undefined;
  /** Objects that get a node at their first visit (the repeats of the first walk). */
  aliases: Set<object> | undefined;
  /** Nodes with `lostLink` the walk went into; cleared when the store is done. */
  relinked: LocationNode[];
}

function newWalk(touched: LocationNode[], aliases?: Set<object>): Walk {
  return { touched, seen: new Set(), repeated: undefined, aliases, relinked: [] };
}

function adopt(raw: object, walk: Walk): LocationNode | undefined {
  let node = nodes.get(raw);
  if (node !== undefined && !node.lostLink) return node;
  if (walk.seen.has(raw)) {
    if (node === undefined) (walk.repeated ??= new Set()).add(raw);
    return node;
  }
  walk.seen.add(raw);
  if (node !== undefined) {
    walk.relinked.push(node);
  } else {
    if ((raw as any)[ReactiveFlags.SKIP] || (raw as any)[ReactiveFlags.IS_REACTIVE]) return undefined;
    if (walk.aliases?.has(raw)) node = ensureLocationNode(raw);
  }
  return adoptChildren(raw, node, walk);
}

/** Walk the children of `raw` (whose node, if any, is `node`); returns its node afterwards. */
function adoptChildren(raw: object, node: LocationNode | undefined, walk: Walk): LocationNode | undefined {
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const child = raw[i];
      if (child !== null && typeof child === "object") node = adoptChild(raw, node, i, child, walk);
    }
    return node;
  }
  if (raw instanceof Map) {
    for (const [key, child] of raw) {
      if (child !== null && typeof child === "object") node = adoptChild(raw, node, key, child, walk);
    }
    return node;
  }
  if (raw instanceof Set) {
    for (const child of raw) {
      if (child !== null && typeof child === "object") node = adoptChild(raw, node, undefined, child, walk);
    }
    return node;
  }
  if (raw instanceof Date || ArrayBuffer.isView(raw)) return node;
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const child = (raw as any)[key];
    if (child !== null && typeof child === "object") node = adoptChild(raw, node, key, child, walk);
  }
  return node;
}

/** Adopt `child` at `container[key]`; returns the container's node (made when needed). */
function adoptChild(
  container: object,
  containerNode: LocationNode | undefined,
  key: unknown,
  child: object,
  walk: Walk
): LocationNode | undefined {
  const childNode = adopt(child, walk);
  if (childNode === undefined) return containerNode;
  containerNode ??= ensureLocationNode(container);
  if (addPlace(childNode, containerNode, key)) walk.touched.push(childNode);
  return containerNode;
}

/**
 * Walk `values` with `visit` (one call per top value), and walk again when
 * the first walk met aliases. Clears `lostLink` on the nodes it went into.
 */
function adoptAll(touched: LocationNode[], visit: (walk: Walk) => void): void {
  let walk = newWalk(touched);
  visit(walk);
  if (walk.repeated !== undefined) {
    const first = walk;
    walk = newWalk(touched, first.repeated);
    visit(walk);
    for (let i = 0; i < first.relinked.length; i++) first.relinked[i].lostLink = false;
  }
  for (let i = 0; i < walk.relinked.length; i++) walk.relinked[i].lostLink = false;
}

function pruneTouched(touched: LocationNode[]): void {
  for (let i = 0; i < touched.length; i++) {
    if (touched[i].places.length > 1) prunePlaces(touched[i]);
  }
}

/**
 * Does `raw` hold an object directly? A value without a node that holds
 * none has nothing below it to place, and the walk can be skipped.
 */
function hasObjectChild(raw: object): boolean {
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) if (isObject(raw[i])) return true;
    return false;
  }
  if (Object.getPrototypeOf(raw) !== Object.prototype) {
    if (raw instanceof Map || raw instanceof Set) {
      for (const child of raw.values()) if (isObject(child)) return true;
      return false;
    }
    if (raw instanceof Date || ArrayBuffer.isView(raw)) return false;
  }
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && isObject((raw as any)[key])) return true;
  }
  return false;
}

/** Must the values `relink` inserts be walked? Not when each is a new leaf, met once. */
function insertedNeedWalk(inserted: readonly unknown[]): boolean {
  for (let i = 0; i < inserted.length; i++) {
    const value = inserted[i];
    if (!isObject(value)) continue;
    const node = nodes.get(value);
    if (node !== undefined) {
      if (node.lostLink) return true;
      continue;
    }
    if (hasObjectChild(value) || inserted.indexOf(value, i + 1) !== -1) return true;
  }
  return false;
}

/** `parent[key]` now holds `value` (a raw object). */
export function attachValue(value: object, parent: LocationNode, key: unknown): void {
  const existing = nodes.get(value);
  if (existing !== undefined && !existing.lostLink) {
    // a known object moved or got a second place; its children keep theirs
    if (addPlace(existing, parent, key) && existing.places.length > 1) prunePlaces(existing);
    return;
  }
  if (existing === undefined && !hasObjectChild(value)) return;
  const touched: LocationNode[] = [];
  adoptAll(touched, (walk) => {
    const node = adopt(value, walk);
    if (node !== undefined && addPlace(node, parent, key)) touched.push(node);
  });
  pruneTouched(touched);
}

/**
 * A new root: give places to the objects in its initial value that need
 * them now, which are the aliases (an object at two places) and the
 * containers above them. Other objects get their place when they are read.
 */
export function adoptRoot(node: LocationNode): void {
  const touched: LocationNode[] = [];
  adoptAll(touched, (walk) => {
    walk.seen.add(node.raw);
    adoptChildren(node.raw, node, walk);
  });
  pruneTouched(touched);
}

/**
 * After a structural change of `array` (its node `arrayNode`): items from
 * index `from` to the end get their current index, `removed` items lose
 * their place here, and `inserted` items (raw) join the tree.
 */
export function relinkArray(
  arrayNode: LocationNode,
  array: readonly unknown[],
  from: number,
  removed?: readonly unknown[],
  inserted?: readonly unknown[]
): void {
  relink(arrayNode, array, from, removed, inserted, false);
}

/**
 * After `sort`, `reverse`, `fill` or `copyWithin`: like `relinkArray` from
 * index 0, and an object without a node that now sits at two indexes (an
 * alias the change made) gets a node with both places.
 */
export function relinkReorder(
  arrayNode: LocationNode,
  array: readonly unknown[],
  removed: readonly unknown[],
  inserted?: readonly unknown[]
): void {
  relink(arrayNode, array, 0, removed, inserted, true);
}

function relink(
  arrayNode: LocationNode,
  array: readonly unknown[],
  from: number,
  removed: readonly unknown[] | undefined,
  inserted: readonly unknown[] | undefined,
  findAliases: boolean
): void {
  const touched: LocationNode[] = [];
  if (inserted !== undefined && insertedNeedWalk(inserted)) {
    adoptAll(touched, (walk) => {
      for (let i = 0; i < inserted.length; i++) {
        const value = inserted[i];
        if (isObject(value)) adopt(value, walk);
      }
    });
  }
  if (removed !== undefined) {
    for (let i = 0; i < removed.length; i++) {
      const value = removed[i];
      if (isObject(value)) {
        const node = nodes.get(value);
        if (node !== undefined) stripIndexes(node, arrayNode, from);
      }
    }
  }
  const call = ++relinkCalls;
  // index of the first visit of each object without a node
  let firstIndex: Map<object, number> | undefined;
  for (let i = from; i < array.length; i++) {
    const value = array[i];
    if (!isObject(value)) continue;
    let node = nodes.get(value);
    if (node === undefined) {
      if (!findAliases) continue;
      // an object without a node here twice (fill, copyWithin, a reorder of
      // unread items) gets one now, with both indexes
      const first = (firstIndex ??= new Map()).get(value);
      if (first === undefined) {
        firstIndex.set(value, i);
        continue;
      }
      if ((value as any)[ReactiveFlags.SKIP]) continue;
      node = ensureLocationNode(value);
      node.relinked = call;
      node.places.push(new Place(arrayNode, first));
    } else if (node.relinked !== call) {
      // first time this call meets the object: move its place here
      node.relinked = call;
      const places = node.places;
      if (
        places.length === 1 &&
        places[0].parentId === arrayNode.id &&
        typeof places[0].key === "number" &&
        places[0].key >= from
      ) {
        places[0].key = i;
        continue;
      }
      stripIndexes(node, arrayNode, from);
    }
    node.places.push(new Place(arrayNode, i));
    if (node.places.length > 1) touched.push(node);
  }
  pruneTouched(touched);
}

let relinkCalls = 0;

function stripIndexes(node: LocationNode, arrayNode: LocationNode, from: number): void {
  const places = node.places;
  for (let i = places.length - 1; i >= 0; i--) {
    const place = places[i];
    if (place.parentId === arrayNode.id && typeof place.key === "number" && place.key >= from) {
      places.splice(i, 1);
    }
  }
}

/**
 * Drop the proxy cache entries of an object that left the tree, and of its
 * children that left with it, so GC can collect them. An object that is
 * still placed under a root (it moved) keeps its proxy.
 */
export function evictDeep(value: any, parent?: LocationNode): void {
  if (value == null || typeof value !== "object") return;
  value = toRaw(value);
  const proxy = globalSeen.get(value);
  if (proxy === undefined) return; // not proxied, skip entire subtree

  const node = nodes.get(value);
  if (node !== undefined) {
    const onlyUnderParent =
      parent !== undefined &&
      node.root === undefined &&
      node.places.length === 1 &&
      node.places[0].parentId === parent.id;
    if (!onlyUnderParent && isAttached(node)) return;
    node.proxy = undefined;
    node.evicted = new WeakRef(proxy);
  }

  globalSeen.delete(value);
  wrapperCache.delete(value);
  proxyStats.staleEvicted++;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (value[i] != null && typeof value[i] === "object") evictDeep(value[i], node);
    }
  } else if (value instanceof Map) {
    for (const child of value.values()) {
      if (child != null && typeof child === "object") evictDeep(child, node);
    }
  } else if (value instanceof Set) {
    for (const child of value) {
      if (child != null && typeof child === "object") evictDeep(child, node);
    }
  } else {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const child = value[keys[i]];
      if (child != null && typeof child === "object") evictDeep(child, node);
    }
  }
}

/** The proxy an evicted object had, if it is still alive; it goes back in the caches. */
export function restoreEvicted(node: LocationNode): object | undefined {
  const proxy = node.evicted?.deref();
  node.evicted = undefined;
  if (proxy === undefined) return undefined;
  node.proxy = proxy;
  globalSeen.set(node.raw, proxy);
  wrapperCache.set(node.raw, proxy);
  proxyStats.staleEvicted--;
  return proxy;
}
