import { ReactiveFlags } from "./constants";
import type { EmitFunction, Path, StateEvent } from "./types";
import {
  Named,
  REACHES,
  UnsupportedStateError,
  cloneStored,
  cloneTree,
  cloneTreeAfter,
  cloneTreeUnless,
  copiedFresh,
  copyingPayloads,
  hasReplicaIndex,
  nameCopyOfCopy,
  nameMember,
  globalSeen,
  locationNodes,
  setData,
  wrapperCache,
  proxyStats,
  toRaw,
} from "./utils";

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

/** A root's queue: `events[next]` is the oldest event not delivered yet. */
interface Undelivered {
  events: StateEvent[];
  next: number;
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
    parent.childPlaces++;
  }

  /** The container's node; undefined once the container was collected. */
  get parent(): LocationNode | undefined {
    return this.parentRef.deref();
  }
}

/** `place` left its node's `places`: its container counts one place fewer (see `childPlaces`). */
function dropped(place: Place): void {
  const parent = place.parent;
  if (parent !== undefined) parent.childPlaces--;
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
  /**
   * A Set or Map whose members have an index by token (see `replicaIndex`
   * in utils.ts): its proxy keeps that index as it changes the collection.
   */
  indexed: boolean;
}

/**
 * A node with more places than this finds one of them through its `index`,
 * and prunes them only when their number doubled since the last time (see
 * `prunePlaces`), so storing or reading such an object at one more place
 * does not walk all of its places again. Most objects have one place.
 */
const WIDE = 8;

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

const nodes = locationNodes;
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
    const kind = raw instanceof Map ? ContainerKind.Map : raw instanceof Set ? ContainerKind.Set : ContainerKind.Plain;
    node = {
      id: ++nodeCount,
      raw,
      kind,
      places: [],
      root: undefined,
      scope: undefined,
      proxy: undefined,
      evicted: undefined,
      relinked: 0,
      relinkedPlaces: 0,
      lostLink: false,
      dataOnly: undefined,
      childPlaces: 0,
      walk: 0,
      touched: 0,
      pruned: 0,
      index: undefined,
      // a replica's collection gets its first proxy after `updateState` indexed it
      indexed: kind !== ContainerKind.Plain && hasReplicaIndex(raw),
    };
    nodes.set(raw, node);
  }
  return node;
}

/**
 * Does a write to `prop` of `target` (raw; its node is `node`) call an own
 * setter? Read from the property's descriptor, unless the object had no own
 * accessor when its proxy first wrote to it: a write through a proxy adds
 * only data properties, so then there is none to find, and no descriptor
 * is made per write. An accessor added later (`Object.defineProperty`) is
 * outside the supported input. An object with more than 64 own keys is not
 * scanned and reads the descriptor at every write.
 */
export function writesThroughSetter(target: object, prop: PropertyKey, node: LocationNode): boolean {
  let dataOnly = node.dataOnly;
  if (dataOnly === undefined) dataOnly = node.dataOnly = hasNoOwnAccessor(target);
  if (dataOnly) return false;
  const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
  return descriptor !== undefined && descriptor.set !== undefined;
}

function hasNoOwnAccessor(target: object): boolean {
  const keys = Reflect.ownKeys(target);
  if (keys.length > 64) return false;
  for (let i = 0; i < keys.length; i++) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, keys[i])!;
    if (descriptor.get !== undefined || descriptor.set !== undefined) return false;
  }
  return true;
}

/**
 * Does `parent` (the place's container, if it is still alive) still hold
 * `raw` at the place? A raw write outside the proxies can break it. A proxy
 * of `raw` counts as `raw`: a store leaves one where it cannot put the raw
 * object (a frozen object, a read-only property, a getter).
 */
function holdsIn(parent: LocationNode | undefined, key: unknown, raw: object): parent is LocationNode {
  if (parent === undefined) return false;
  const container = parent.raw as any;
  switch (parent.kind) {
    case ContainerKind.Map: {
      const held = container.get(key);
      return held === raw || proxyOf(held, raw);
    }
    case ContainerKind.Set:
      return container.has(raw);
    default: {
      const held = container[key as PropertyKey];
      return held === raw || proxyOf(held, raw);
    }
  }
}

/** Is `held` a proxy of `raw`? */
function proxyOf(held: unknown, raw: object): boolean {
  return isObject(held) && (held as any)[ReactiveFlags.RAW] !== undefined && toRaw(held) === raw;
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
      dropped(place);
      // a new array: an index made for the old one no longer applies
      current.places = [];
      return null;
    }
    (reversed ??= []).push(segment(parent, place.key, current.raw));
    current = parent;
  }
  return undefined;
}

/** A node `findAll` is in: its places, the next one to follow, and whether one was stale. */
interface FindFrame {
  node: LocationNode;
  places: Place[];
  next: number;
  stale: boolean;
}

/**
 * Every root path of `node`, plus `tail` when given, by the general walk: a
 * path follows places up to a root, and never meets a node twice. Places
 * that no longer hold the object are dropped on the way. With `firstOnly`,
 * stops at the first path found. The walk keeps its own stack, so any depth
 * fits, and builds each path once.
 */
function findAll(node: LocationNode, tail: PropertyKey | undefined, firstOnly: boolean): Found[] {
  const out: Found[] = [];
  // the segments from the node up to the frame on top, nearest first
  const segments: string[] = [];
  const visiting = new Set<LocationNode>();
  const frames: FindFrame[] = [];
  const enter = (entered: LocationNode): void => {
    visiting.add(entered);
    const root = entered.root;
    if (root !== undefined) out.push({ root, path: buildPath(root.path, segments, tail) });
    frames.push({ node: entered, places: entered.places, next: 0, stale: false });
  };
  enter(node);
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    const current = frame.node;
    if (frame.next < frame.places.length && !(firstOnly && out.length > 0)) {
      const place = frame.places[frame.next++];
      const parent = place.parent;
      if (!holdsIn(parent, place.key, current.raw)) {
        frame.stale = true;
        continue;
      }
      if (visiting.has(parent)) continue;
      segments.push(segment(parent, place.key, current.raw));
      enter(parent);
      continue;
    }
    frames.pop();
    if (frame.stale) current.places = keepPlaces(frame.places, (place) => holds(place, current.raw));
    visiting.delete(current);
    if (frames.length > 0) segments.pop();
  }
  return out;
}

/** `base`, then `reversed` from its end to its start, then `tail` when given. */
function buildPath(base: Path, reversed: string[] | undefined, tail: PropertyKey | undefined): Path {
  const middle = reversed === undefined ? 0 : reversed.length;
  const path: Path = new Array(base.length + middle + (tail === undefined ? 0 : 1));
  let index = 0;
  for (let i = 0; i < base.length; i++) path[index++] = base[i];
  for (let i = middle - 1; i >= 0; i--) path[index++] = reversed![i];
  if (tail !== undefined) path[index] = String(tail);
  return path;
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
 * Was the object in the tree just before the store that is placing it now?
 * Its places are read as they are, before the store adds its own. `former`
 * is the node of the value that store replaced, when the written object was
 * in the tree: only that store took it out, so it still counts. A place the
 * store itself changed (an index a splice shifted) reads as gone, so an
 * object that was in the tree can get false. False only costs a walk.
 */
function attachedBefore(node: LocationNode, former: LocationNode | undefined): boolean {
  let current = node;
  for (let steps = 0; steps < FAST_CHAIN_LIMIT; steps++) {
    if (current.root !== undefined || current === former) return true;
    const places = current.places;
    if (places.length !== 1) break;
    const place = places[0];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, current.raw)) return false;
    current = parent;
  }
  if (current.root !== undefined || current === former) return true;
  // Several places, or a long chain: search depth first, and stop at the
  // first container that is in the tree. An object at thousands of places
  // usually finds one through its first place.
  const visited = new Set<LocationNode>();
  visited.add(current);
  const stack: LocationNode[] = [current];
  const next: number[] = [0];
  while (stack.length > 0) {
    const top = stack.length - 1;
    const at = stack[top];
    const places = at.places;
    if (next[top] >= places.length) {
      stack.pop();
      next.pop();
      continue;
    }
    const place = places[next[top]++];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, at.raw)) continue;
    if (parent.root !== undefined || parent === former) return true;
    if (visited.has(parent)) continue;
    visited.add(parent);
    stack.push(parent);
    next.push(0);
  }
  return false;
}

/**
 * Send `event` to every path of `target`. Its payload holds copies already
 * (`copyPayload` or `copyPayloadAfter`, made before the write). Every
 * further path gets copies of the stored values (`newValue`, `value`,
 * `items`), all made before the first emit, so a listener that changes one
 * cannot change another, and two remote places never share one object.
 * The first path gets `event` itself. What the write removed is copied per
 * path only where `copyPayload` copied it (an async root); otherwise every
 * path carries the removed value itself, shared by the events.
 */
export function dispatch(target: Target, event: StateEvent): void {
  const { root, paths } = target;
  if (paths.length === 1) {
    if (root.undelivered === undefined) root.emit!(event);
    else deliver(root, [event]);
    return;
  }
  // copies of the payload copies: their set members and map keys name the same members
  deliver(root, copyingPayloads(() => copiesPerPath(event, paths, root.async)));
}

/** `event` for its first path, and a copy of it for each other path (see `dispatch`). */
function copiesPerPath(event: StateEvent, paths: Path[], async: boolean): StateEvent[] {
  const removesValue = event.action === "set-delete";
  const events: StateEvent[] = [event];
  for (let i = 1; i < paths.length; i++) {
    // copies of copies: a tree with cycles only, so they cannot pass the limit
    const copy = { ...event, path: paths[i] };
    if (isObject(event.newValue)) copy.newValue = cloneTree(event.newValue, event.action === "replace" ? Named.Below : Named.None);
    if (isObject(event.value) && !removesValue) {
      copy.value = cloneTree(event.value, Named.All);
      nameCopyOfCopy(event.value, copy.value);
    }
    if (event.items !== undefined) copy.items = cloneTree(event.items, Named.Below);
    if (async) {
      if (isObject(event.oldValue)) copy.oldValue = cloneTree(event.oldValue, Named.All);
      if (event.oldValues !== undefined) copy.oldValues = cloneTree(event.oldValues, Named.Below);
      if (removesValue) {
        copy.value = copy.oldValue;
        nameCopyOfCopy(event.value, copy.value);
      }
    }
    events.push(copy);
  }
  return events;
}

/**
 * Deliver the `events` of one write to `root.emit`, in order, after the
 * events earlier writes left undelivered under this root.
 *
 * A listener can write while it receives an event. That write changed the
 * state after the events still waiting (the other places of an alias), so
 * its own events go after them: it adds them to the root's queue, then
 * delivers the queue from the oldest event, before it returns. So events
 * reach `emit` in the order the state changed, every write is delivered
 * before it returns, and a write made while nothing waits is delivered at
 * once, inside the listener call that made it.
 *
 * An `emit` that throws does not stop the others: every event in the queue
 * is delivered once, each for a write that already changed the state, then
 * the first error reaches the write that was delivering them. A listener
 * that called that write may catch it and go on.
 */
export function deliver(root: LocationRoot, events: StateEvent[]): void {
  const emit = root.emit!;
  let queue = root.undelivered;
  if (queue === undefined) {
    if (events.length === 1) {
      emit(events[0]);
      return;
    }
    queue = root.undelivered = { events, next: 0 };
  } else {
    for (let i = 0; i < events.length; i++) queue.events.push(events[i]);
  }
  let failed = false;
  let failure: unknown;
  while (queue.next < queue.events.length) {
    try {
      emit(queue.events[queue.next++]);
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (root.undelivered === queue) root.undelivered = undefined;
  if (failed) throw failure;
}

/** What `copyPayload` did. */
export const enum Copied {
  /** Nothing: the payload reaches its container (see `copyPayloadReaching`). */
  Reaches,
  /** Copied the payload. */
  Done,
  /**
   * Copied the payload, and the values it stores (`newValue`, `value`,
   * `items`) are fresh (see `cloneStored`): the place walk of this store
   * would find nothing in them, so `attachValue` and `relinkArray` skip it.
   * The finding holds for this store only; a later store of the same
   * values walks them again.
   */
  Fresh,
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
 * `value` of a `set-delete`) is copied only for an async root
 * (`target.root.async`), whose events wait for a microtask. A synchronous
 * root delivers the event before the write returns, and sends the removed
 * value itself, as 1.0.44 did, so it never refuses a removal. Assignment
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
export function copyPayload(
  event: StateEvent | undefined,
  target: Target | undefined,
  container: object,
  held?: Set<object>
): Copied {
  if (event === undefined) return Copied.Done;
  const removed = target!.root.async;
  const { newValue, oldValue, value, items, oldValues } = event;
  // a set's deleted member is a removed value (it is the `oldValue` too)
  const stored = event.action !== "set-delete";
  let fresh = true;
  let newCopy = newValue;
  if (isObject(newValue)) {
    // a store with held items walks only those items, which costs less than
    // finding the copy fresh (see `heldItems`)
    newCopy =
      held === undefined
        ? cloneStored(newValue, container, event.action === "replace" ? Named.Below : Named.None)
        : cloneTreeUnless(newValue, container, event.action === "replace" ? Named.Below : Named.None);
    if (newCopy === REACHES) return Copied.Reaches;
    fresh = held === undefined && copiedFresh;
  }
  let valueCopy = value;
  if (isObject(value) && stored) {
    valueCopy = cloneStored(value, container, Named.All);
    if (valueCopy === REACHES) return Copied.Reaches;
    fresh &&= copiedFresh;
  }
  let itemsCopy: unknown = items;
  if (items !== undefined && holdsObject(items)) {
    itemsCopy = cloneStored(items, container, Named.Below);
    if (itemsCopy === REACHES) return Copied.Reaches;
    fresh &&= copiedFresh;
  }
  if (removed) {
    const oldCopy = isObject(oldValue) ? cloneTreeUnless(oldValue, container, Named.All) : oldValue;
    if (oldCopy === REACHES) return Copied.Reaches;
    const oldValuesCopy =
      oldValues !== undefined && holdsObject(oldValues)
        ? cloneTreeUnless(oldValues, container, Named.Below)
        : oldValues;
    if (oldValuesCopy === REACHES) return Copied.Reaches;
    if (isObject(oldValue)) event.oldValue = oldCopy;
    if (oldValues !== undefined) event.oldValues = oldValuesCopy as any[];
    if (!stored) valueCopy = event.oldValue;
  }
  if (isObject(newValue)) event.newValue = newCopy;
  // a set member: `container` is its set, and a `set-add` puts it there
  if (isObject(value)) event.value = nameMember(value, valueCopy, container, stored);
  if (items !== undefined) event.items = itemsCopy as any[];
  return fresh ? Copied.Fresh : Copied.Done;
}

/**
 * `copyPayloadAfter` for a write that `copyPayload` refused because its
 * payload reaches `container`. A getter in that payload would be read
 * before the write, and could give another value after it, so an accessor
 * property in it is refused (an `UnsupportedStateError`) without being
 * read. `after` comes from `shallowCopy`, which refuses the container's own.
 */
export function copyPayloadReaching(event: StateEvent, target: Target, container: object, after: object): void {
  refuseAccessors(event, target.root.async, container, after);
  copyPayloadAfter(event, target, container, after);
}

/**
 * Like `copyPayload`, for a payload that reaches `container`: `after` (a
 * `shallowCopy` of `container` with the write made on it) stands in for
 * `container`, so the payload is copied as it will be after the write,
 * before the write. Throws a `SnapshotLimitError` when it is too large to
 * copy; the write is then never made, and nothing needs to be put back.
 */
export function copyPayloadAfter(event: StateEvent, target: Target, container: object, after: object): void {
  const { newValue, oldValue, value, items, oldValues } = event;
  const removed = target.root.async;
  const stored = event.action !== "set-delete";
  const newCopy = isObject(newValue) ? cloneTreeAfter(newValue, container, after, event.action === "replace" ? Named.Below : Named.None) : newValue;
  const oldCopy = removed && isObject(oldValue) ? cloneTreeAfter(oldValue, container, after, Named.All) : oldValue;
  const valueCopy = !isObject(value)
    ? value
    : stored
      ? cloneTreeAfter(value, container, after, Named.All)
      : oldCopy;
  const itemsCopy =
    items !== undefined && holdsObject(items) ? cloneTreeAfter(items, container, after, Named.Below) : items;
  const oldValuesCopy =
    removed && oldValues !== undefined && holdsObject(oldValues)
      ? cloneTreeAfter(oldValues, container, after, Named.Below)
      : oldValues;
  if (isObject(newValue)) event.newValue = newCopy;
  if (isObject(oldValue)) event.oldValue = oldCopy;
  if (isObject(value)) event.value = nameMember(value, valueCopy, container, stored);
  if (items !== undefined) event.items = itemsCopy;
  if (oldValues !== undefined) event.oldValues = oldValuesCopy;
}

function holdsObject(values: readonly unknown[]): boolean {
  for (let i = 0; i < values.length; i++) if (isObject(values[i])) return true;
  return false;
}

/**
 * A copy of `container` (raw) that holds the same entries, of the same kind
 * and prototype: an array holds the same items, a map the same entries, a
 * set the same members, an object the same own enumerable properties (as
 * data). A write is made on it to copy a payload as it will be after that
 * write (see `copyPayloadReaching`). An own enumerable accessor of an object
 * is refused (an `UnsupportedStateError`) without being read.
 */
export function shallowCopy(container: object): any {
  const copy = Array.isArray(container) ? container.slice()
    : container instanceof Map ? new Map(Map.prototype.entries.call(container))
    : container instanceof Set ? new Set(Set.prototype.values.call(container))
    : Object.create(Object.getPrototypeOf(container));
  const keys = Reflect.ownKeys(container);
  for (let i = 0; i < keys.length; i++) {
    const value = enumerableData(container, keys[i]);
    if (value !== NOT_ENUMERABLE) setData(copy, keys[i], value);
  }
  return copy;
}

const NOT_ENUMERABLE = Symbol("not enumerable");

/** The value of `object[key]` when it is an own enumerable data property; refuses an accessor. */
function enumerableData(object: object, key: PropertyKey): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(object, key)!;
  if (!descriptor.enumerable) return NOT_ENUMERABLE;
  if (descriptor.get !== undefined || descriptor.set !== undefined) {
    throw new UnsupportedStateError(
      `the accessor property '${String(key)}' sits in a payload that reaches back into the ` +
        `object it is written to, and a getter cannot be read as it will be after the write`
    );
  }
  return descriptor.value;
}

/**
 * Refuse (see `copyPayloadReaching`) an own enumerable accessor anywhere in
 * the payload of `event` that is copied (what the write removes only when
 * `removed`), reading `after` for `container`, without calling it. Array
 * indexes are not checked: an accessor index is a descriptor change,
 * outside the supported input.
 */
function refuseAccessors(event: StateEvent, removed: boolean, container: object, after: object): void {
  const pending: unknown[] = [event.newValue];
  if (event.action !== "set-delete") pending.push(event.value);
  if (event.items !== undefined) pending.push(event.items);
  if (removed) {
    pending.push(event.oldValue);
    if (event.oldValues !== undefined) pending.push(event.oldValues);
  }
  const seen = new Set<object>();
  while (pending.length > 0) {
    const entry = pending.pop();
    if (!isObject(entry)) continue;
    let value: object = toRaw(entry);
    if (value === container) value = after;
    if (seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) pending.push(value[i]);
    } else if (value instanceof Map) {
      for (const [key, item] of Map.prototype.entries.call(value)) pending.push(key, item);
    } else if (value instanceof Set) {
      for (const item of Set.prototype.values.call(value)) pending.push(item);
    }
    const keys = Reflect.ownKeys(value);
    for (let i = 0; i < keys.length; i++) {
      const item = enumerableData(value, keys[i]);
      if (item !== NOT_ENUMERABLE) pending.push(item);
    }
  }
}

/** Add a place unless it is already known. Returns true when it was new. */
function addPlace(node: LocationNode, parent: LocationNode, key: unknown): boolean {
  if (findPlace(node, parent, key) !== undefined) return false;
  pushPlace(node, new Place(parent, key));
  return true;
}

/** The place of `node` at `parent[key]`, if it has one. */
function findPlace(node: LocationNode, parent: LocationNode, key: unknown): Place | undefined {
  const places = node.places;
  if (places.length <= WIDE) {
    for (let i = 0; i < places.length; i++) {
      if (samePlace(places[i], parent, key)) return places[i];
    }
    return undefined;
  }
  let index = node.index;
  if (index === undefined || index.places !== places || index.length !== places.length) {
    index = node.index = { places, length: places.length, byParent: new Map() };
    for (let i = 0; i < places.length; i++) indexPlace(index.byParent, places[i]);
  }
  const entry = index.byParent.get(parent.id);
  if (entry === undefined) return undefined;
  if (entry instanceof Place) return parent.kind === ContainerKind.Set || entry.key === key ? entry : undefined;
  return entry.get(key);
}

function indexPlace(byParent: Map<number, Place | Map<unknown, Place>>, place: Place): void {
  const entry = byParent.get(place.parentId);
  if (entry === undefined) byParent.set(place.parentId, place);
  else if (entry instanceof Place) {
    if (entry.key !== place.key) byParent.set(place.parentId, new Map<unknown, Place>([[entry.key, entry], [place.key, place]]));
  } else if (!entry.has(place.key)) entry.set(place.key, place);
}

/** Add `place` to the places of `node`, which has no place at its container and key. */
function pushPlace(node: LocationNode, place: Place): void {
  const places = node.places;
  places.push(place);
  const index = node.index;
  if (index !== undefined && index.places === places && index.length === places.length - 1) {
    index.length++;
    indexPlace(index.byParent, place);
  }
}

/**
 * Drop places that no longer hold the object. If some places are under a
 * root, also drop the ones under detached parents: the object moved, and
 * every write would walk the dead ends. Such a parent is marked, so storing
 * it again gives the place back (see `lostLink`).
 */
function prunePlaces(node: LocationNode): void {
  const count = node.places.length;
  // a wide node prunes when its places doubled: a store or read that adds
  // one more place does not check all of them again
  if (count > WIDE && count < 2 * node.pruned) return;
  let places = keepPlaces(node.places, (place) => holds(place, node.raw));
  if (places.length > 1) {
    // isAttached prunes nothing, so one scratch array serves every call
    const live = pruneScratch;
    live.length = places.length;
    let attached = 0;
    // places in one container (an array that holds the object at many indexes) ask once
    let parent: LocationNode | undefined;
    let parentAttached = false;
    for (let i = 0; i < places.length; i++) {
      const next = places[i].parent!;
      if (next !== parent) {
        parent = next;
        parentAttached = isAttached(next);
      }
      live[i] = parentAttached;
      if (parentAttached) attached++;
    }
    if (attached > 0 && attached < places.length) {
      const kept: Place[] = [];
      for (let i = 0; i < places.length; i++) {
        if (live[i]) kept.push(places[i]);
        else {
          markLostLink(places[i].parent!);
          dropped(places[i]);
        }
      }
      places = kept;
    }
  }
  pruneScratch.length = 0;
  node.places = places;
  node.pruned = places.length;
}

const pruneScratch: boolean[] = [];

/** The places that pass `keep`; the others are dropped. */
function keepPlaces(places: Place[], keep: (place: Place) => boolean): Place[] {
  const kept: Place[] = [];
  for (let i = 0; i < places.length; i++) {
    if (keep(places[i])) kept.push(places[i]);
    else dropped(places[i]);
  }
  return kept;
}

/** `node` lost a child's place; it and every container above it relink on their next store. */
function markLostLink(node: LocationNode): void {
  if (node.lostLink) return;
  node.lostLink = true;
  const pending = [node];
  while (pending.length > 0) {
    const places = pending.pop()!.places;
    for (let i = 0; i < places.length; i++) {
      const parent = places[i].parent;
      if (parent !== undefined && !parent.lostLink) {
        parent.lostLink = true;
        pending.push(parent);
      }
    }
  }
}

/**
 * Record that a proxy read found `raw` at `parent[key]`. Called on every read
 * of a nested object, so the common case (place already known) is one
 * compare, and a wide node finds the place in its index.
 */
export function notePlace(node: LocationNode, parent: LocationNode, key: unknown): void {
  const places = node.places;
  if (places.length === 1 && samePlace(places[0], parent, key)) return;
  if (addPlace(node, parent, key) && node.places.length > 1) prunePlaces(node);
}

/** `parent[key]` no longer holds `value`. */
export function detachPlace(value: object, parent: LocationNode, key: unknown): void {
  const node = nodes.get(value);
  if (node !== undefined) removePlace(node, parent, key);
}

/** Drop the place of `node` at `parent[key]`; true when it had one. */
function removePlace(node: LocationNode, parent: LocationNode, key: unknown): boolean {
  const places = node.places;
  if (places.length <= WIDE) {
    for (let i = 0; i < places.length; i++) {
      if (samePlace(places[i], parent, key)) {
        dropped(places[i]);
        places.splice(i, 1);
        node.index = undefined;
        return true;
      }
    }
    return false;
  }
  const place = findPlace(node, parent, key);
  if (place === undefined) return false;
  const at = places.indexOf(place);
  if (at < 0) {
    node.index = undefined;
    return false;
  }
  dropped(place);
  places.splice(at, 1);
  // the index stays: it loses this place
  const index = node.index!;
  index.length--;
  const entry = index.byParent.get(place.parentId);
  if (entry === place) index.byParent.delete(place.parentId);
  else if (entry instanceof Map && entry.get(place.key) === place) entry.delete(place.key);
  return true;
}

/**
 * One walk over values that were just stored. It gives a place to every
 * object inside them that has a node, and stops at those objects when they
 * were in the tree just before this store (see `attachedBefore`): their own
 * children still hold their places under them, unless the object lost one
 * (`lostLink`). A known object that comes back from outside the tree is
 * walked like a new one: while it was out, an object below it may have been
 * stored elsewhere, and storing it next to that object makes an alias.
 * Containers on the way get nodes only when something inside them has one.
 *
 * An object met twice is an alias (or a cycle). The first walk only notes
 * it; a second walk then gives each such object a node at its first visit,
 * so every later visit records its place. The second walk also goes into
 * the containers the first walk gave a node (they hold a known object), as
 * an alias below them needs its place there too. Each walk marks the nodes
 * it met (`LocationNode.walk`) and keeps a set of the objects without a node
 * it met, so it meets each object once and asks `attachedBefore` once.
 *
 * A proxy found in the value (a spread of a proxy leaves them at any depth)
 * stands for its raw object: the walk writes the raw object in its place
 * (see `storeRaw`) and goes on with it, so the state never holds a proxy
 * that a later read would wrap again.
 *
 * The work of a walk grows with the objects it meets and the places it
 * adds. A place whose container or object got its node in this walk is
 * new, so it is added without a search; the second walk adds again only
 * the places the first could not.
 */
interface Walk {
  /** This walk, in `LocationNode.walk`. */
  id: number;
  /** The store this walk belongs to (see `touch`). */
  store: number;
  /** Nodes made from here on are made in this walk. */
  firstId: number;
  touched: LocationNode[];
  seen: Set<object>;
  /** Objects without a node the walk met more than once. */
  repeated: Set<object> | undefined;
  /** Objects that get a node at their first visit (the repeats of the first walk). */
  aliases: Set<object> | undefined;
  /**
   * Objects with a node this walk went into: containers it gave a node to
   * (they hold a known object), and known objects that came back.
   */
  created: Set<object> | undefined;
  /** Objects with a node the walk goes into anyway (the `created` of the first walk). */
  revisit: Set<object> | undefined;
  /** Nodes with `lostLink` the walk went into; cleared when the store is done. */
  relinked: LocationNode[];
  /** The node of the value the store replaced, when it was in the tree (see `attachedBefore`). */
  former: LocationNode | undefined;
  /** Objects without a node that were in the tree before this store (see `heldBefore`). */
  held: Set<object> | undefined;
}

function newWalk(
  touched: LocationNode[],
  store: number,
  former: LocationNode | undefined,
  held: Set<object> | undefined,
  first?: Walk
): Walk {
  return {
    id: ++stamps,
    store,
    firstId: nodeCount + 1,
    touched,
    seen: new Set(),
    repeated: undefined,
    aliases: first?.repeated,
    created: undefined,
    revisit: first?.created,
    relinked: [],
    former,
    held,
  };
}

/** What kind of children an `AdoptFrame` visits. */
const enum ChildKind {
  Array,
  Map,
  Set,
  Object,
  /** A date or a typed array: none to visit. */
  None,
}

/**
 * An object the walk is in. Its children are visited one at a time; a child
 * that needs a walk of its own gets a frame on top, and its place here is
 * added when that frame ends. The walk keeps this stack itself, so any
 * depth fits, and it visits and places in the order of a recursive walk.
 */
interface AdoptFrame {
  raw: object;
  /** The object's node, made when a child has one. */
  node: LocationNode | undefined;
  /** The object had no node when the walk met it. */
  unknown: boolean;
  /** Its key in the object of the frame below. */
  key: unknown;
  kind: ChildKind;
  /** The next index of an array, or of `keys`. */
  next: number;
  keys: string[] | undefined;
  entries: Iterator<any> | undefined;
  /** The key of the child visited last. */
  childKey: unknown;
  /** A set's proxy members and their raw objects, swapped in when the frame ends (see `storeRaw`). */
  swaps: Map<object, object> | undefined;
}

function adoptFrame(raw: object, node: LocationNode | undefined, unknown: boolean, key: unknown): AdoptFrame {
  let kind = ChildKind.Object;
  let keys: string[] | undefined;
  let entries: Iterator<any> | undefined;
  if (Array.isArray(raw)) kind = ChildKind.Array;
  else if (raw instanceof Map) {
    kind = ChildKind.Map;
    entries = Map.prototype.entries.call(raw);
  } else if (raw instanceof Set) {
    kind = ChildKind.Set;
    entries = Set.prototype.values.call(raw);
  } else if (raw instanceof Date || ArrayBuffer.isView(raw)) kind = ChildKind.None;
  else keys = Object.keys(raw);
  return { raw, node, unknown, key, kind, next: 0, keys, entries, childKey: undefined, swaps: undefined };
}

/** The next child object of the frame's object, with its key in `childKey`; undefined after the last. */
function nextChild(frame: AdoptFrame): object | undefined {
  const raw = frame.raw as any;
  switch (frame.kind) {
    case ChildKind.Array:
      while (frame.next < raw.length) {
        const index = frame.next++;
        const child = raw[index];
        if (isObject(child)) {
          frame.childKey = index;
          return child;
        }
      }
      return undefined;
    case ChildKind.Map:
      for (;;) {
        const step = frame.entries!.next();
        if (step.done) return undefined;
        const child = step.value[1];
        if (isObject(child)) {
          frame.childKey = step.value[0];
          return child;
        }
      }
    case ChildKind.Set:
      for (;;) {
        const step = frame.entries!.next();
        if (step.done) return undefined;
        if (isObject(step.value)) {
          frame.childKey = undefined;
          return step.value;
        }
      }
    case ChildKind.Object: {
      const keys = frame.keys!;
      while (frame.next < keys.length) {
        const key = keys[frame.next++];
        const child = raw[key];
        if (isObject(child)) {
          frame.childKey = key;
          return child;
        }
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Meet `raw` at `key` of the object of the top frame: returns its node, or
 * pushes a frame to walk its children (its place is added when that ends).
 */
function enterAdopt(raw: object, key: unknown, walk: Walk, frames: AdoptFrame[]): LocationNode | undefined {
  let node = nodes.get(raw);
  if (node !== undefined) {
    // met before in this walk: the caller adds this place
    if (node.walk === walk.id) return node;
    node.walk = walk.id;
    if (!node.lostLink && walk.revisit?.has(raw) !== true) {
      if (attachedBefore(node, walk.former)) return node;
      // it comes back from outside the tree: walk it, in both walks
      if (walk.aliases === undefined) (walk.created ??= new Set()).add(raw);
    }
    if (node.lostLink) walk.relinked.push(node);
    frames.push(adoptFrame(raw, node, false, key));
    return node;
  }
  if ((raw as any)[ReactiveFlags.SKIP]) return undefined;
  if ((raw as any)[ReactiveFlags.IS_REACTIVE]) {
    // a proxy stands for its raw object (a proxy has no node of its own)
    const target = toRaw(raw);
    if (frames.length > 0) storeRaw(frames[frames.length - 1], key, raw, target);
    return enterAdopt(target, key, walk, frames);
  }
  // one set operation: an object already seen leaves the size as it was
  const seen = walk.seen;
  const size = seen.size;
  seen.add(raw);
  if (seen.size === size) {
    (walk.repeated ??= new Set()).add(raw);
    return undefined;
  }
  if (walk.aliases?.has(raw)) node = walkNode(raw, walk);
  if (walk.held?.has(raw)) return node;
  frames.push(adoptFrame(raw, node, true, key));
  return node;
}

/** A node for `raw`, made in `walk`, which has met it. */
function walkNode(raw: object, walk: Walk): LocationNode {
  const node = ensureLocationNode(raw);
  node.walk = walk.id;
  return node;
}

/**
 * Put `target` where the frame's object holds `proxy` (its proxy), at `key`.
 * An object or array changes only an own data property that holds the
 * proxy, through `Reflect.set`: no setter runs, and a frozen or sealed
 * object, or a read-only property, keeps the proxy without a throw. A map
 * changes the value at `key`; its keys stay as they are. A set swaps its
 * member when the frame ends, in its place, so its order stays and the
 * walk does not meet the raw object twice.
 */
function storeRaw(frame: AdoptFrame, key: unknown, proxy: object, target: object): void {
  const container = frame.raw as any;
  switch (frame.kind) {
    case ChildKind.Map:
      Map.prototype.set.call(container, key, target);
      return;
    case ChildKind.Set:
      (frame.swaps ??= new Map()).set(proxy, target);
      return;
    default: {
      const descriptor = Reflect.getOwnPropertyDescriptor(container, key as PropertyKey);
      if (descriptor !== undefined && descriptor.value === proxy) Reflect.set(container, key as PropertyKey, target);
    }
  }
}

/** Swap the members of a set the walk found proxies for (see `storeRaw`), keeping the order. */
function swapMembers(set: Set<unknown>, swaps: Map<object, object>): void {
  const members = Array.from(Set.prototype.values.call(set));
  Set.prototype.clear.call(set);
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    Set.prototype.add.call(set, (isObject(member) && swaps.get(member)) || member);
  }
}

/** The child at `key` of the frame's object has `childNode`: give it its place there. */
function placeChild(frame: AdoptFrame, key: unknown, childNode: LocationNode | undefined, walk: Walk): void {
  if (childNode === undefined) return;
  const parent = (frame.node ??= walkNode(frame.raw, walk));
  if (parent.id < walk.firstId && childNode.id < walk.firstId) {
    // Both had nodes before this walk, so the place may be there already. The
    // first walk placed every child that had a node when it met it there; in
    // the second, only an object it met again before giving it a node (an
    // ancestor on a cycle, among `aliases`) may lack its place.
    if (walk.aliases !== undefined && !walk.aliases.has(childNode.raw)) return;
    if (!addPlace(childNode, parent, key)) return;
  } else {
    pushPlace(childNode, new Place(parent, key));
  }
  touch(childNode, walk.store, walk.touched);
}

/** Add `node` to the nodes `store` prunes when it ends, once. */
function touch(node: LocationNode, store: number, touched: LocationNode[]): void {
  if (node.touched === store) return;
  node.touched = store;
  touched.push(node);
}

/** Numbers for walks and stores (see `LocationNode.walk`, `touch`); never reused. */
let stamps = 0;

/** Walk the frames to the end; returns the node of the bottom frame's object, if it has one. */
function walkFrames(frames: AdoptFrame[], walk: Walk): LocationNode | undefined {
  for (;;) {
    const frame = frames[frames.length - 1];
    const child = nextChild(frame);
    if (child !== undefined) {
      const depth = frames.length;
      const childNode = enterAdopt(child, frame.childKey, walk, frames);
      if (frames.length === depth) placeChild(frame, frame.childKey, childNode, walk);
      continue;
    }
    frames.pop();
    if (frame.swaps !== undefined) swapMembers(frame.raw as Set<unknown>, frame.swaps);
    const node = frame.node;
    if (frame.unknown && node !== undefined && walk.aliases === undefined) (walk.created ??= new Set()).add(frame.raw);
    if (frames.length === 0) return node;
    placeChild(frames[frames.length - 1], frame.key, node, walk);
  }
}

/** Adopt `raw` and what it holds; returns its node, if it has one. */
function adopt(raw: object, walk: Walk): LocationNode | undefined {
  const frames: AdoptFrame[] = [];
  const node = enterAdopt(raw, undefined, walk, frames);
  return frames.length === 0 ? node : walkFrames(frames, walk);
}

/**
 * Walk `values` with `visit` (one call per top value), and walk again when
 * the first walk met aliases. Clears `lostLink` on the nodes it went into.
 */
function adoptAll(
  touched: LocationNode[],
  store: number,
  former: LocationNode | undefined,
  held: Set<object> | undefined,
  visit: (walk: Walk) => void
): void {
  let walk = newWalk(touched, store, former, held);
  visit(walk);
  if (walk.repeated !== undefined) {
    const first = walk;
    walk = newWalk(touched, store, former, held, first);
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
      const entries = raw instanceof Map ? Map.prototype.values.call(raw) : Set.prototype.values.call(raw);
      for (const child of entries) if (isObject(child)) return true;
      return false;
    }
    if (raw instanceof Date || ArrayBuffer.isView(raw)) return false;
  }
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && isObject((raw as any)[key])) return true;
  }
  return false;
}

/**
 * Must the values `relink` inserts be walked? Not when each is a new leaf met
 * once, or a known object that was in the tree before.
 */
function insertedNeedWalk(inserted: readonly unknown[]): boolean {
  // fresh leaves met so far, to find one inserted twice
  let fresh: Set<object> | undefined;
  for (let i = 0; i < inserted.length; i++) {
    const value = inserted[i];
    if (!isObject(value)) continue;
    const node = nodes.get(value);
    if (node !== undefined) {
      if (node.lostLink || !attachedBefore(node, undefined)) return true;
      continue;
    }
    if (hasObjectChild(value)) return true;
    if (inserted.length > 1) {
      if (fresh === undefined) fresh = new Set();
      else if (fresh.has(value)) return true;
      fresh.add(value);
    }
  }
  return false;
}

/**
 * The objects a store into an array need not walk: when `value` (an array
 * written over `replaced`, an array that was in the tree) holds no object
 * without a node that `replaced` does not hold too, as after a `filter`,
 * then the items of `replaced`. An object without a node that was in the
 * tree has nothing below it that needs a place: an object below it gets a
 * node only through its proxy, which gives it a node first, or at a second
 * place, which a store made through a proxy (see "Supported inputs" in the
 * README). Undefined when some object without a node comes from elsewhere.
 */
function heldBefore(value: object, replaced: unknown): Set<object> | undefined {
  if (!Array.isArray(value) || !Array.isArray(replaced)) return undefined;
  let before: Set<object> | undefined;
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!isObject(item) || nodes.get(item) !== undefined) continue;
    if (before === undefined) {
      // a value of new items fails at its first one, without a set
      if (replaced.indexOf(item) === -1) return undefined;
      before = new Set();
      for (let j = 0; j < replaced.length; j++) if (isObject(replaced[j])) before.add(replaced[j]);
    }
    if (!before.has(item)) return undefined;
  }
  return before;
}

/**
 * `heldBefore` for a store of `value` over `replaced`, the value it writes
 * over when its container was in the tree (see `attachedBefore`); undefined
 * when `replaced` has no node. Made before the write, for `copyPayload` and
 * `attachValue`.
 */
export function heldItems(value: unknown, replaced: unknown): Set<object> | undefined {
  if (!isObject(value) || !isObject(replaced) || nodes.get(replaced) === undefined) return undefined;
  return heldBefore(value, replaced);
}

/**
 * `parent[key]` now holds `value` (a raw object). A `fresh` value (the copy
 * this store made found it fresh, see `cloneStored`) has nothing to place.
 * `replaced` is the value the store wrote over, when `parent` was in the
 * tree before the store (see `attachedBefore`), and `held` is
 * `heldItems(value, replaced)`.
 */
export function attachValue(
  value: object,
  parent: LocationNode,
  key: unknown,
  fresh: boolean,
  replaced?: unknown,
  held?: Set<object>
): void {
  if (fresh) return;
  const former = isObject(replaced) ? nodes.get(replaced) : undefined;
  const existing = nodes.get(value);
  if (existing !== undefined && !existing.lostLink && attachedBefore(existing, former)) {
    // a known object moved or got a second place; its children keep theirs
    if (addPlace(existing, parent, key) && existing.places.length > 1) prunePlaces(existing);
    return;
  }
  if (existing === undefined && !hasObjectChild(value)) return;
  const touched: LocationNode[] = [];
  const store = ++stamps;
  adoptAll(touched, store, former, held, (walk) => {
    const node = adopt(value, walk);
    if (node !== undefined && addPlace(node, parent, key)) touch(node, store, touched);
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
  adoptAll(touched, ++stamps, undefined, undefined, (walk) => {
    node.walk = walk.id;
    walkFrames([adoptFrame(node.raw, node, false, undefined)], walk);
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
  inserted?: readonly unknown[],
  insertedFresh = false
): void {
  // the copy this insertion made found the items fresh: nothing in them needs a place
  if (insertedFresh) inserted = undefined;
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
  const store = ++stamps;
  if (inserted !== undefined && insertedNeedWalk(inserted)) {
    adoptAll(touched, store, undefined, undefined, (walk) => {
      for (let i = 0; i < inserted.length; i++) {
        const value = inserted[i];
        if (isObject(value)) adopt(value, walk);
      }
    });
  }
  // a removed item with a node may still sit at another index, without its places here
  let removedNode = false;
  if (removed !== undefined) {
    for (let i = 0; i < removed.length; i++) {
      const value = removed[i];
      if (isObject(value)) {
        const node = nodes.get(value);
        if (node !== undefined) {
          stripIndexes(node, arrayNode, from);
          removedNode = true;
        }
      }
    }
  }
  const call = ++relinkCalls;
  // index of the first visit of each object without a node
  let firstIndex: Map<object, number> | undefined;
  // Places here before the change still to meet. An item without a place
  // here needs none, unless it was inserted or removed with a node (a removed
  // object can sit at another index too) or is an alias a reorder made, so
  // once every such place was met the rest is skipped.
  let left = findAliases || removedNode || holdsNode(inserted) ? Infinity : arrayNode.childPlaces;
  for (let i = from; i < array.length && left > 0; i++) {
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
      node.relinkedPlaces = 0;
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
        // a node with one place has no index (see `WIDE`)
        places[0].key = i;
        node.relinkedPlaces = 0;
        left--;
        continue;
      }
      // its old places here, met again one per index it sits at now
      node.relinkedPlaces = stripIndexes(node, arrayNode, from);
    }
    if (node.relinkedPlaces > 0) {
      node.relinkedPlaces--;
      left--;
    }
    node.places.push(new Place(arrayNode, i));
    if (node.places.length > 1) touch(node, store, touched);
  }
  pruneTouched(touched);
}

let relinkCalls = 0;

/** Does `values` hold an object with a location node? */
function holdsNode(values: readonly unknown[] | undefined): boolean {
  if (values === undefined) return false;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (isObject(value) && nodes.get(value) !== undefined) return true;
  }
  return false;
}

/** Drop the places of `node` at indexes of `arrayNode` from `from` on; returns how many. */
function stripIndexes(node: LocationNode, arrayNode: LocationNode, from: number): number {
  const places = node.places;
  let count = 0;
  for (let i = places.length - 1; i >= 0; i--) {
    const place = places[i];
    if (place.parentId === arrayNode.id && typeof place.key === "number" && place.key >= from) {
      arrayNode.childPlaces--;
      places.splice(i, 1);
      count++;
    }
  }
  if (count > 0) node.index = undefined;
  return count;
}

/**
 * Drop the proxy cache entries of an object that left the tree, and of its
 * children that left with it, so GC can collect them. An object that is
 * still placed under a root (it moved) keeps its proxy.
 */
export function evictDeep(value: any, parent?: LocationNode): void {
  if (value == null || typeof value !== "object") return;
  const top = toRaw(value);
  if (globalSeen.get(top) === undefined) return; // not proxied, skip entire subtree
  // proxied objects to evict, each after the node of the container it was found in and its key there
  const pending: unknown[] = [parent, undefined, top];
  while (pending.length > 0) {
    const raw: any = pending.pop();
    const key = pending.pop();
    const container = pending.pop() as LocationNode | undefined;
    const proxy = globalSeen.get(raw);
    if (proxy === undefined) continue; // evicted at another place meanwhile

    const node = nodes.get(raw);
    if (node !== undefined) {
      const places = node.places;
      const onlyUnderParent =
        container !== undefined &&
        node.root === undefined &&
        places.length === 1 &&
        places[0].parentId === container.id;
      if (!onlyUnderParent) {
        // An evicted container left the tree, so its place is a dead end for
        // an object that also sits elsewhere. Dropped, it is not searched
        // again (rows that share one object, removed one at a time). Storing
        // the container again walks it and gives the place back (`lostLink`).
        if (container !== undefined && places.length > 1 && removePlace(node, container, key)) markLostLink(container);
        if (isAttached(node)) continue;
      }
      node.proxy = undefined;
      node.evicted = new WeakRef(proxy);
    }

    globalSeen.delete(raw);
    wrapperCache.delete(raw);
    proxyStats.staleEvicted++;

    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) pushProxied(raw[i], node, i, pending);
    } else if (raw instanceof Map) {
      Map.prototype.forEach.call(raw, (child: unknown, key: unknown) => pushProxied(child, node, key, pending));
    } else if (raw instanceof Set) {
      for (const child of Set.prototype.values.call(raw)) pushProxied(child, node, undefined, pending);
    } else {
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i++) pushProxied(raw[keys[i]], node, keys[i], pending);
    }
  }
}

/** Add `value` to `pending` with its container's node and key when it is a proxied object; a subtree without a proxy is skipped. */
function pushProxied(value: unknown, container: LocationNode | undefined, key: unknown, pending: unknown[]): void {
  if (value === null || typeof value !== "object") return;
  const raw = toRaw(value);
  if (globalSeen.get(raw) !== undefined) pending.push(container, key, raw);
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
