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
 * shared object then emits one event per place.
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
  /** The last `relinkArray` call that placed this object (tells repeats apart). */
  relinked: number;
}

const nodes = new WeakMap<object, LocationNode>();
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
      evicted: undefined,
      relinked: 0,
    };
    nodes.set(raw, node);
  }
  return node;
}

/** Does the place still hold `raw`? A raw write outside the proxies can break it. */
function holds(place: Place, raw: object): boolean {
  const container = place.parent.raw as any;
  switch (place.parent.kind) {
    case ContainerKind.Map:
      return container.get(place.key) === raw;
    case ContainerKind.Set:
      return container.has(raw);
    default:
      return container[place.key as PropertyKey] === raw;
  }
}

function segment(place: Place, raw: object): string {
  if (place.parent.kind === ContainerKind.Set) {
    // set members have no key; their path segment is their current position
    let index = 0;
    for (const member of place.parent.raw as Set<unknown>) {
      if (member === raw) break;
      index++;
    }
    return String(index);
  }
  return String(place.key);
}

function samePlace(place: Place, parent: LocationNode, key: unknown): boolean {
  return place.parent === parent && (parent.kind === ContainerKind.Set || place.key === key);
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
 * Every root path of `node`, plus `tail` when given. Places that no longer
 * hold the object are dropped on the way. With `firstOnly`, stops at the
 * first path found.
 */
function find(node: LocationNode, tail: PropertyKey | undefined, firstOnly: boolean): Found[] {
  // Fast path: one chain of single places up to one root.
  let reversed: string[] | undefined;
  let current = node;
  for (let steps = 0; steps < FAST_CHAIN_LIMIT; steps++) {
    const places = current.places;
    const root = current.root;
    if (root !== undefined) {
      if (places.length !== 0) break;
      return [{ root, path: buildPath(root.path, reversed, tail) }];
    }
    if (places.length !== 1) {
      if (places.length === 0) return [];
      break;
    }
    const place = places[0];
    if (!holds(place, current.raw)) {
      places.length = 0;
      return [];
    }
    (reversed ??= []).push(segment(place, current.raw));
    current = place.parent;
  }

  // General case: several places, a root that is also placed, or a cycle.
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
    if (!holds(place, node.raw)) {
      stale = true;
      continue;
    }
    collect(place.parent, [segment(place, node.raw), ...suffix], visiting, out, firstOnly);
  }
  if (stale) node.places = places.filter((place) => holds(place, node.raw));
  visiting.delete(node);
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
export function locate(node: LocationNode, tail?: PropertyKey): Target | undefined {
  const found = find(node, tail, false);
  if (found.length === 0) return undefined;
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
  return find(node, undefined, true).length > 0;
}

/**
 * Send `event` to every path of `target`. The first path gets `event`
 * itself; each further one gets a copy with its own path and cloned payload,
 * so two remote places never share one object.
 */
export function dispatch(target: Target, event: StateEvent): void {
  const { root, paths } = target;
  const emit = root.emit!;
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (i === 0) {
      event.path = path;
      emit(event);
      continue;
    }
    const copy: StateEvent = { ...event, path };
    if ("newValue" in event) copy.newValue = cloneTree(event.newValue);
    if ("value" in event) copy.value = cloneTree(event.value);
    if (event.items !== undefined) copy.items = cloneTree(event.items);
    emit(copy);
  }
}

/** Add a place unless it is already known. Returns true when it was new. */
function addPlace(node: LocationNode, parent: LocationNode, key: unknown): boolean {
  const places = node.places;
  for (let i = 0; i < places.length; i++) {
    if (samePlace(places[i], parent, key)) return false;
  }
  places.push({ parent, key });
  return true;
}

/**
 * Drop places that no longer hold the object. If some places are under a
 * root, also drop the ones under detached parents: the object moved, and the
 * old parent must not keep it (or be kept by it).
 */
function prunePlaces(node: LocationNode): void {
  let places = node.places.filter((place) => holds(place, node.raw));
  if (places.length > 1) {
    const live = places.filter((place) => isAttached(place.parent));
    if (live.length > 0) places = live;
  }
  node.places = places;
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
 * Walk a value that was just stored and give every wrapped object inside it
 * a place. The walk stops at an object that already has a node: its own
 * children still hold their places under it. Containers on the way get
 * nodes only when something inside them has one. Returns the value's node,
 * if any.
 */
function adopt(raw: object, touched: LocationNode[], seen: Set<object>): LocationNode | undefined {
  const existing = nodes.get(raw);
  if (existing !== undefined) return existing;
  if (seen.has(raw)) return undefined;
  seen.add(raw);
  if ((raw as any)[ReactiveFlags.SKIP] || (raw as any)[ReactiveFlags.IS_REACTIVE]) return undefined;
  let node: LocationNode | undefined;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const child = raw[i];
      if (child !== null && typeof child === "object") node = adoptChild(raw, node, i, child, touched, seen);
    }
    return node;
  }
  if (raw instanceof Map) {
    for (const [key, child] of raw) {
      if (child !== null && typeof child === "object") node = adoptChild(raw, node, key, child, touched, seen);
    }
    return node;
  }
  if (raw instanceof Set) {
    for (const child of raw) {
      if (child !== null && typeof child === "object") node = adoptChild(raw, node, undefined, child, touched, seen);
    }
    return node;
  }
  if (raw instanceof Date || ArrayBuffer.isView(raw)) return undefined;
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const child = (raw as any)[key];
    if (child !== null && typeof child === "object") node = adoptChild(raw, node, key, child, touched, seen);
  }
  return node;
}

/** Adopt `child` at `container[key]`; returns the container's node (made when needed). */
function adoptChild(
  container: object,
  containerNode: LocationNode | undefined,
  key: unknown,
  child: object,
  touched: LocationNode[],
  seen: Set<object>
): LocationNode | undefined {
  const childNode = adopt(child, touched, seen);
  if (childNode === undefined) return containerNode;
  containerNode ??= ensureLocationNode(container);
  if (addPlace(childNode, containerNode, key)) touched.push(childNode);
  return containerNode;
}

function pruneTouched(touched: LocationNode[]): void {
  for (let i = 0; i < touched.length; i++) {
    if (touched[i].places.length > 1) prunePlaces(touched[i]);
  }
}

/** `parent[key]` now holds `value` (a raw object). */
export function attachValue(value: object, parent: LocationNode, key: unknown): void {
  const touched: LocationNode[] = [];
  const node = adopt(value, touched, new Set());
  if (node !== undefined && addPlace(node, parent, key)) touched.push(node);
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
  const touched: LocationNode[] = [];
  if (inserted !== undefined) {
    const seen = new Set<object>();
    for (let i = 0; i < inserted.length; i++) {
      const value = inserted[i];
      if (isObject(value)) adopt(value, touched, seen);
    }
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
  for (let i = from; i < array.length; i++) {
    const value = array[i];
    if (!isObject(value)) continue;
    const node = nodes.get(value);
    if (node === undefined) continue;
    if (node.relinked !== call) {
      // first time this call meets the object: move its place here
      node.relinked = call;
      const places = node.places;
      if (
        places.length === 1 &&
        places[0].parent === arrayNode &&
        typeof places[0].key === "number" &&
        places[0].key >= from
      ) {
        places[0].key = i;
        continue;
      }
      stripIndexes(node, arrayNode, from);
    }
    node.places.push({ parent: arrayNode, key: i });
    if (node.places.length > 1) touched.push(node);
  }
  pruneTouched(touched);
}

let relinkCalls = 0;

function stripIndexes(node: LocationNode, arrayNode: LocationNode, from: number): void {
  const places = node.places;
  for (let i = places.length - 1; i >= 0; i--) {
    const place = places[i];
    if (place.parent === arrayNode && typeof place.key === "number" && place.key >= from) {
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
      node.places[0].parent === parent;
    if (!onlyUnderParent && isAttached(node)) return;
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
  globalSeen.set(node.raw, proxy);
  wrapperCache.set(node.raw, proxy);
  proxyStats.staleEvicted--;
  return proxy;
}
