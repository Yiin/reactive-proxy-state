import { ReactiveFlags } from "./constants";
import type { EmitFunction, Path, StateEvent } from "./types";
import {
  REACHES,
  UnsupportedStateError,
  cloneStored,
  cloneTree,
  cloneTreeAfter,
  cloneTreeUnless,
  copiedFresh,
  globalSeen,
  locationNodes,
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
  /**
   * The object had no own accessor property when its proxy first wrote to
   * it (see `writesThroughSetter`); undefined before that write.
   */
  dataOnly: boolean | undefined;
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
      dataOnly: undefined,
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
  // several places, or a long chain: search every place
  const pending: LocationNode[] = [current];
  const visited = new Set<LocationNode>(pending);
  while (pending.length > 0) {
    const next = pending.pop()!;
    if (next.root !== undefined || next === former) return true;
    const places = next.places;
    for (let i = 0; i < places.length; i++) {
      const parent = places[i].parent;
      if (!holdsIn(parent, places[i].key, next.raw) || visited.has(parent)) continue;
      visited.add(parent);
      pending.push(parent);
    }
  }
  return false;
}

/**
 * Send `event` to every path of `target`. Its payload holds copies already
 * (`copyPayload` or `copyPayloadAfter`, made before the write). Every
 * further path gets copies of those copies, all made before the first emit,
 * so a listener that changes a payload cannot change another, and two
 * remote places never share one object. The first path gets `event` itself.
 */
export function dispatch(target: Target, event: StateEvent): void {
  const { root, paths } = target;
  if (paths.length === 1) {
    if (root.undelivered === undefined) root.emit!(event);
    else deliver(root, [event]);
    return;
  }
  const events: StateEvent[] = [event];
  for (let i = 1; i < paths.length; i++) {
    // copies of copies: a tree with cycles only, so they cannot pass the limit
    const copy = { ...event, path: paths[i] };
    if (isObject(event.newValue)) copy.newValue = cloneTree(event.newValue);
    if (isObject(event.oldValue)) copy.oldValue = cloneTree(event.oldValue);
    if (isObject(event.value)) copy.value = cloneTree(event.value);
    if (event.items !== undefined) copy.items = cloneTree(event.items);
    if (event.oldValues !== undefined) copy.oldValues = cloneTree(event.oldValues);
    events.push(copy);
  }
  deliver(root, events);
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
 * An `emit` that throws drops the events of this root not delivered yet; the
 * error reaches the write that was delivering them.
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
  try {
    while (queue.next < queue.events.length) emit(queue.events[queue.next++]);
  } catch (error) {
    // a listener that called this write may catch the error: its own loop ends too
    queue.events.length = 0;
    queue.next = 0;
    throw error;
  } finally {
    if (root.undelivered === queue && queue.next === queue.events.length) root.undelivered = undefined;
  }
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
 * A payload that reaches `container` would be copied as `container` is
 * before the write. Then nothing is copied and the result is
 * `Copied.Reaches`: the caller makes the write on `shallowCopy(container)`
 * and copies with `copyPayloadReaching`, still before the write.
 *
 * `held` comes from `heldItems` for the store of `newValue`: the place walk
 * of that store skips those items, so the copy does not check freshness.
 */
export function copyPayload(event: StateEvent | undefined, container: object, held?: Set<object>): Copied {
  if (event === undefined) return Copied.Done;
  const { newValue, oldValue, value, items, oldValues } = event;
  let fresh = true;
  let newCopy = newValue;
  if (isObject(newValue)) {
    // a store with held items walks only those items, which costs less than
    // finding the copy fresh (see `heldItems`)
    newCopy = held === undefined ? cloneStored(newValue, container) : cloneTreeUnless(newValue, container);
    if (newCopy === REACHES) return Copied.Reaches;
    fresh = held === undefined && copiedFresh;
  }
  let valueCopy = value;
  if (isObject(value)) {
    valueCopy = cloneStored(value, container);
    if (valueCopy === REACHES) return Copied.Reaches;
    fresh &&= copiedFresh;
  }
  let itemsCopy: unknown = items;
  if (items !== undefined && holdsObject(items)) {
    itemsCopy = cloneStored(items, container);
    if (itemsCopy === REACHES) return Copied.Reaches;
    fresh &&= copiedFresh;
  }
  const oldCopy = isObject(oldValue) ? cloneTreeUnless(oldValue, container) : oldValue;
  if (oldCopy === REACHES) return Copied.Reaches;
  const oldValuesCopy =
    oldValues !== undefined && holdsObject(oldValues) ? cloneTreeUnless(oldValues, container) : oldValues;
  if (oldValuesCopy === REACHES) return Copied.Reaches;
  if (isObject(newValue)) event.newValue = newCopy;
  if (isObject(oldValue)) event.oldValue = oldCopy;
  if (isObject(value)) event.value = valueCopy;
  if (items !== undefined) event.items = itemsCopy as any[];
  if (oldValues !== undefined) event.oldValues = oldValuesCopy as any[];
  return fresh ? Copied.Fresh : Copied.Done;
}

/**
 * `copyPayloadAfter` for a write that `copyPayload` refused because its
 * payload reaches `container`. A getter in that payload would be read
 * before the write, and could give another value after it, so an accessor
 * property in it is refused (an `UnsupportedStateError`) without being
 * read. `after` comes from `shallowCopy`, which refuses the container's own.
 */
export function copyPayloadReaching(event: StateEvent, container: object, after: object): void {
  refuseAccessors(event, container, after);
  copyPayloadAfter(event, container, after);
}

/**
 * Like `copyPayload`, for a payload that reaches `container`: `after` (a
 * `shallowCopy` of `container` with the write made on it) stands in for
 * `container`, so the payload is copied as it will be after the write,
 * before the write. Throws a `SnapshotLimitError` when it is too large to
 * copy; the write is then never made, and nothing needs to be put back.
 */
export function copyPayloadAfter(event: StateEvent, container: object, after: object): void {
  const { newValue, oldValue, value, items, oldValues } = event;
  const newCopy = isObject(newValue) ? cloneTreeAfter(newValue, container, after) : newValue;
  const oldCopy = isObject(oldValue) ? cloneTreeAfter(oldValue, container, after) : oldValue;
  const valueCopy = isObject(value) ? cloneTreeAfter(value, container, after) : value;
  const itemsCopy = items !== undefined && holdsObject(items) ? cloneTreeAfter(items, container, after) : items;
  const oldValuesCopy =
    oldValues !== undefined && holdsObject(oldValues) ? cloneTreeAfter(oldValues, container, after) : oldValues;
  if (isObject(newValue)) event.newValue = newCopy;
  if (isObject(oldValue)) event.oldValue = oldCopy;
  if (isObject(value)) event.value = valueCopy;
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
  if (Array.isArray(container)) return container.slice();
  if (container instanceof Map) return new Map(container);
  if (container instanceof Set) return new Set(container);
  const copy = Object.create(Object.getPrototypeOf(container));
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
 * the payload of `event`, reading `after` for `container`, without calling
 * it. Array indexes are not checked: an accessor index is a descriptor
 * change, outside the supported input.
 */
function refuseAccessors(event: StateEvent, container: object, after: object): void {
  const pending: unknown[] = [event.newValue, event.oldValue, event.value];
  if (event.items !== undefined) pending.push(event.items);
  if (event.oldValues !== undefined) pending.push(event.oldValues);
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
      for (const [key, item] of value) pending.push(key, item);
    } else if (value instanceof Set) {
      for (const item of value) pending.push(item);
    } else if (!(value instanceof Date)) {
      const keys = Reflect.ownKeys(value);
      for (let i = 0; i < keys.length; i++) {
        const item = enumerableData(value, keys[i]);
        if (item !== NOT_ENUMERABLE) pending.push(item);
      }
    }
  }
}

/**
 * `copy[key] = value` on an object `shallowCopy` made, as an own enumerable
 * data property: no setter of the copy's prototype runs.
 */
export function setData(copy: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(copy, key, { value, writable: true, enumerable: true, configurable: true });
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
 * an alias below them needs its place there too. Each walk keeps its own
 * set of visited objects.
 */
interface Walk {
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
  former: LocationNode | undefined,
  held: Set<object> | undefined,
  first?: Walk
): Walk {
  return {
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

function adopt(raw: object, walk: Walk): LocationNode | undefined {
  let node = nodes.get(raw);
  if (node !== undefined && !node.lostLink && walk.revisit?.has(raw) !== true) {
    if (attachedBefore(node, walk.former)) return node;
    // it comes back from outside the tree: walk it, in both walks
    if (walk.aliases === undefined) (walk.created ??= new Set()).add(raw);
  }
  // one set operation: an object already seen leaves the size as it was
  const seen = walk.seen;
  const size = seen.size;
  seen.add(raw);
  if (seen.size === size) {
    if (node === undefined) (walk.repeated ??= new Set()).add(raw);
    return node;
  }
  if (node !== undefined) {
    if (node.lostLink) walk.relinked.push(node);
    return adoptChildren(raw, node, walk);
  }
  if ((raw as any)[ReactiveFlags.SKIP] || (raw as any)[ReactiveFlags.IS_REACTIVE]) return undefined;
  if (walk.aliases?.has(raw)) node = ensureLocationNode(raw);
  if (walk.held?.has(raw)) return node;
  node = adoptChildren(raw, node, walk);
  if (node !== undefined && walk.aliases === undefined) (walk.created ??= new Set()).add(raw);
  return node;
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
function adoptAll(
  touched: LocationNode[],
  former: LocationNode | undefined,
  held: Set<object> | undefined,
  visit: (walk: Walk) => void
): void {
  let walk = newWalk(touched, former, held);
  visit(walk);
  if (walk.repeated !== undefined) {
    const first = walk;
    walk = newWalk(touched, former, held, first);
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
  adoptAll(touched, former, held, (walk) => {
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
  adoptAll(touched, undefined, undefined, (walk) => {
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
  if (inserted !== undefined && insertedNeedWalk(inserted)) {
    adoptAll(touched, undefined, undefined, (walk) => {
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
