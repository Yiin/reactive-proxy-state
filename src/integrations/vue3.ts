import {
  ReactiveEffect,
  effectScope,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  pauseTracking,
  reactive,
  resetTracking,
  shallowReactive,
  toRaw,
  type EffectScope,
} from "@vue/reactivity";
import { deepClone } from "../utils";
import type { Path, StateEvent } from "../types";

export type DiffErrorContext = {
  /** The first key of `path`, or '' when the failure is in the root object itself. */
  key: string;
  /** Path of the event whose listener threw, or of the object whose scan failed. */
  path: (string | number | symbol)[];
  error: unknown;
};

export type TrackVueReactiveEventsOptions = {
  emitInitialReplace?: boolean;
  onDiffError?: (ctx: DiffErrorContext) => void;
};

export type VueTrackingControl = {
  /** Stop tracking for good. A stopped tracker cannot restart: pause() and resume() after stop() only warn. */
  stop: () => void;
  /** Stop sending events. Writes still keep the tracker's copy of the state in step, so resume() costs nothing. */
  pause: () => void;
  /** Send events again. Writes made while paused are never sent. */
  resume: () => void;
};

/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Every object and array in the state gets its own small Vue effect (a node)
 * that reads only its own entries, so a write re-runs only the node it changed.
 * Each node keeps a plain copy of its entries and diffs against it with the
 * rules 2.0.0 used, so the events are the same: leaf-level sets, deletes,
 * array grows as per-index sets, shrinks as one `length` set, a type change as
 * one whole-value set. A Map or Set is one node that reads the whole collection
 * and emits `map-set` / `set-add` with whole values.
 *
 * Returns a control object with stop/pause/resume. Use pause/resume around
 * writes that must not be sent back (e.g. server events).
 */
export function trackVueReactiveEvents<T extends object>(
  vueState: T,
  emit: (event: StateEvent) => void,
  options: TrackVueReactiveEventsOptions = {}
): VueTrackingControl {
  const { emitInitialReplace = true, onDiffError } = options;
  assertSameVueCopy(vueState);

  if (emitInitialReplace) {
    try {
      emit({ action: "replace", path: [], newValue: deepClone(vueState) });
    } catch (e) {
      // ignore initial emit failures
    }
  }

  const tracker = new Tracker(emit, onDiffError);
  const root = createNode(tracker, null, null, vueState).start();

  function warnStopped(method: string) {
    console.warn(
      `[reactive-proxy-state] trackVueReactiveEvents: ${method}() after stop() does nothing. stop() is final; create a new tracker to track again.`
    );
  }

  return {
    stop() {
      if (tracker.stopped) return;
      tracker.stopped = true;
      tracker.emitting = false;
      root.dispose();
      tracker.scope.stop();
    },
    pause() {
      if (tracker.stopped) warnStopped("pause");
      else tracker.emitting = false;
    },
    resume() {
      if (tracker.stopped) warnStopped("resume");
      else tracker.emitting = true;
    },
  };
}

/**
 * The nodes read the state through the @vue/reactivity copy this library imports.
 * A proxy made by another copy never links to them, and the tracker would send nothing.
 */
function assertSameVueCopy(state: object): void {
  if (isProxy(state)) {
    // A readonly view cannot be checked this way, and nothing writes through it.
    if (isReadonly(state)) return;
    const raw = toRaw(state);
    if ((isShallow(state) ? shallowReactive(raw) : reactive(raw)) === state) return;
  }
  throw new TypeError(
    "trackVueReactiveEvents: the state is not a reactive() object of the @vue/reactivity copy this library imports. " +
      "Pass the object Vue's reactive() returned. If it is one, the app loads two copies of @vue/reactivity: " +
      "dedupe 'vue' and '@vue/reactivity' in the bundler."
  );
}

type Key = string | number;
type NodeKind = "object" | "array" | "map" | "set";

const hasOwn = Object.prototype.hasOwnProperty;
const NO_CHILDREN: Map<Key, TrackedNode> = new Map();

class Tracker {
  readonly scope: EffectScope = effectScope(true);
  emitting = true;
  stopped = false;
  /** Counts scans; a node keeps the id of the last scan of its parent that kept it. */
  scans = 0;

  constructor(
    readonly listener: (event: StateEvent) => void,
    readonly onDiffError: ((ctx: DiffErrorContext) => void) | undefined
  ) {}

  /** Calls the listener with Vue tracking paused, so reads it makes never become a node's dependencies. */
  emit(event: StateEvent): void {
    pauseTracking();
    try {
      this.listener(event);
    } catch (error) {
      // Report and go on: the scan that sent this event must finish, or the
      // node's copy and its child nodes would no longer match the state.
      this.report(event.path, error);
    } finally {
      resetTracking();
    }
  }

  report(path: Path, error: unknown): void {
    if (this.onDiffError === undefined) return;
    pauseTracking();
    try {
      this.onDiffError({ key: path.length > 0 ? String(path[0]) : "", path, error });
    } finally {
      resetTracking();
    }
  }
}

// Shared effect callbacks: Vue calls them with the node as `this`, so a node keeps no closures.
function scanNode(this: TrackedNode): void {
  this.scan();
}

function rerunNode(this: TrackedNode): void {
  if (this.disposed) return;
  this.run();
  // Vue does not re-trigger a running effect, so a write made during this
  // node's own scan (by the listener, or a sync watcher it set off) is not in
  // the copy yet. One more run takes it in.
  if (!this.disposed && this.dirty) this.run();
}

function createNode(tracker: Tracker, parent: TrackedNode | null, key: Key | null, proxy: object): TrackedNode {
  // Made inside the tracker's own detached scope: a node made during a
  // component's setup or inside a store's scope must not stop with that scope.
  const node = tracker.scope.run(() => new TrackedNode(tracker, parent, key, proxy))!;
  // The scope lists every effect made inside it. The tracker stops its nodes
  // itself, so take the node back off, and the list never grows with churn.
  const effects = (tracker.scope as unknown as { effects: unknown[] }).effects;
  if (effects[effects.length - 1] === node) effects.pop();
  return node;
}

/** One object, array, Map or Set of the state, and its own Vue effect. */
class TrackedNode extends ReactiveEffect<void> {
  readonly tracker: Tracker;
  parent: TrackedNode | null;
  /** Key in the parent; changes when the parent moves this node. */
  key: Key | null;
  readonly proxy: any;
  readonly raw: object;
  readonly kind: NodeKind;
  /** Plain copy of this node's entries; a child's entry is the child's own copy. */
  shadow: any;
  children: Map<Key, TrackedNode>;
  /** Children a scan in progress has matched or made, so a failed scan can stop them. */
  pending: Map<Key, TrackedNode> | null;
  /** Old children by raw object, built when a scan looks for moved children. */
  rawIndex: Map<object, TrackedNode[]> | null;
  /** Id of the last parent scan that kept this node. */
  claim: number;
  started: boolean;
  disposed: boolean;

  constructor(tracker: Tracker, parent: TrackedNode | null, key: Key | null, proxy: object) {
    super(scanNode as () => void);
    this.scheduler = rerunNode as () => void;
    this.tracker = tracker;
    this.parent = parent;
    this.key = key;
    this.proxy = proxy;
    this.raw = toRaw(proxy);
    this.kind = nodeKind(this.raw);
    this.shadow = undefined;
    this.children = NO_CHILDREN;
    this.pending = null;
    this.rawIndex = null;
    this.claim = 0;
    this.started = false;
    this.disposed = false;
  }

  start(): this {
    this.run();
    this.started = true;
    return this;
  }

  path(): Key[] {
    const path: Key[] = [];
    for (let node: TrackedNode = this; node.parent !== null; node = node.parent) path.push(node.key!);
    return path.reverse();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    for (const child of this.children.values()) child.dispose();
    this.children = NO_CHILDREN;
    this.shadow = undefined;
  }

  /** Puts this node's copy into its parent's copy, after the copy was replaced. */
  attachShadow(): void {
    const parent = this.parent;
    if (this.disposed || parent === null || parent.shadow === undefined) return;
    parent.shadow[this.key!] = this.shadow;
  }

  scan(): void {
    try {
      if (this.shadow === undefined) {
        this.firstScan();
        // A node whose rebuild failed before: its parent holds no copy for it yet.
        if (this.started) this.attachShadow();
      } else if (this.kind === "map" || this.kind === "set") {
        this.scanCollection();
      } else {
        this.scanEntries();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  /** Copies the entries without events. Reactive objects get their own nodes. */
  firstScan(): void {
    const proxy = this.proxy;
    if (this.kind === "map" || this.kind === "set") {
      // Read the whole collection through the proxy, so this node depends on all of it.
      this.shadow = deepClone(proxy);
      return;
    }
    if (this.kind === "array") {
      const length: number = proxy.length;
      const shadow = new Array(length);
      this.shadow = shadow;
      for (let index = 0; index < length; index++) shadow[index] = this.adopt(index, proxy[index]);
      return;
    }
    const keys = Object.keys(proxy);
    const shadow: Record<string, unknown> = {};
    this.shadow = shadow;
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      shadow[key] = this.adopt(key, proxy[key]);
    }
  }

  adopt(key: Key, value: unknown): unknown {
    if (!isNodeValue(value)) return copyValue(value);
    const child = this.createChild(key, value);
    if (this.children === NO_CHILDREN) this.children = new Map();
    this.children.set(key, child);
    return child.shadow;
  }

  createChild(key: Key, value: object): TrackedNode {
    const raw = toRaw(value);
    for (let node: TrackedNode | null = this; node !== null; node = node.parent) {
      if (node.raw === raw) {
        throw new Error(`trackVueReactiveEvents: the state holds a cycle at ${[...this.path(), key].join(".")}`);
      }
    }
    return createNode(this.tracker, this, key, value).start();
  }

  /** Map or Set: read the whole collection through the proxy and diff it as 2.0.0 does. */
  scanCollection(): void {
    const current = deepClone(this.proxy);
    if (this.tracker.emitting) diffCollection(current, this.shadow, this.path(), this.tracker);
    if (this.disposed) return;
    this.shadow = current;
    this.attachShadow();
  }

  scanEntries(): void {
    const proxy = this.proxy;
    const isArray = this.kind === "array";
    // The only tracked reads: this node's own keys and values.
    const keys = isArray ? null : Object.keys(proxy);
    const length: number = isArray ? proxy.length : keys!.length;
    const values = new Array(length);
    if (isArray) for (let index = 0; index < length; index++) values[index] = proxy[index];
    else for (let index = 0; index < length; index++) values[index] = proxy[keys![index]];

    // Match each reactive value to a child node: the same node when the same
    // object is still at its key, a moved node when it is at a new key, else a new one.
    const scanId = ++this.tracker.scans;
    const oldChildren = this.children;
    let children: Map<Key, TrackedNode> | null = null;
    let nodes: (TrackedNode | undefined)[] | null = null;
    for (let index = 0; index < length; index++) {
      const value = values[index];
      if (!isNodeValue(value)) continue;
      const key = isArray ? index : keys![index];
      const child = this.resolveChild(key, value, oldChildren, scanId);
      if (children === null) {
        children = new Map();
        this.pending = children;
        nodes = new Array(length);
      }
      children.set(key, child);
      nodes![index] = child;
    }
    this.rawIndex = null;
    // Children that left stop before any event goes out, so their copies can no longer change.
    for (const child of oldChildren.values()) if (child.claim !== scanId) child.dispose();

    if (isArray) this.diffArray(values, nodes, oldChildren);
    else this.diffObject(keys!, values, nodes, oldChildren, scanId);

    this.pending = null;
    if (this.disposed) {
      // The listener removed this node while it scanned.
      if (children !== null) for (const child of children.values()) child.dispose();
      return;
    }
    this.children = children ?? NO_CHILDREN;
  }

  resolveChild(key: Key, value: object, oldChildren: Map<Key, TrackedNode>, scanId: number): TrackedNode {
    const raw = toRaw(value);
    const same = oldChildren.get(key);
    if (same !== undefined && same.raw === raw && same.claim !== scanId) {
      same.claim = scanId;
      return same;
    }
    if (oldChildren !== NO_CHILDREN) {
      this.rawIndex ??= indexByRaw(oldChildren);
      const candidates = this.rawIndex.get(raw);
      if (candidates !== undefined) {
        for (const candidate of candidates) {
          if (candidate.claim === scanId) continue;
          candidate.claim = scanId;
          candidate.key = key;
          return candidate;
        }
      }
    }
    return this.createChild(key, value);
  }

  /** 2.0.0's positional array diff: index by index, then grows as sets, a shrink as one `length` set. */
  diffArray(values: unknown[], nodes: (TrackedNode | undefined)[] | null, oldChildren: Map<Key, TrackedNode>): void {
    const tracker = this.tracker;
    const shadow: unknown[] = this.shadow;
    const emitting = tracker.emitting;
    const path = emitting ? this.path() : null;
    const length = values.length;
    const oldLength = shadow.length;
    for (let index = 0; index < length; index++) {
      const child = nodes === null ? undefined : nodes[index];
      const existed = index < oldLength;
      // Entries below `index` are new already; this one still holds the old value.
      const before = shadow[index];
      const after = child !== undefined ? child.shadow : copyValue(values[index]);
      if (emitting && !(existed && (child !== undefined ? oldChildren.get(index) === child : before === after))) {
        path!.push(index);
        if (existed) diffPlain(after, before, path!, tracker);
        else tracker.emit({ action: "set", path: path!.slice(), newValue: copyValue(after) });
        path!.pop();
      }
      shadow[index] = after;
    }
    if (length < oldLength) {
      if (emitting) {
        path!.push("length");
        tracker.emit({ action: "set", path: path!.slice(), newValue: length, oldValue: oldLength });
        path!.pop();
      }
      shadow.length = length;
    }
  }

  /** 2.0.0's object diff: deletes first in the copy's key order, then each current key. */
  diffObject(
    keys: string[],
    values: unknown[],
    nodes: (TrackedNode | undefined)[] | null,
    oldChildren: Map<Key, TrackedNode>,
    scanId: number
  ): void {
    const tracker = this.tracker;
    const raw = this.raw;
    const shadow: Record<string, unknown> = this.shadow;
    const emitting = tracker.emitting;
    const path = emitting ? this.path() : null;
    for (const key of Object.keys(shadow)) {
      if (hasOwn.call(raw, key)) continue;
      if (emitting) {
        // A gone child's copy has no other user, so it goes out as is. A moved child's copy is still live.
        const gone = oldChildren.get(key);
        const oldValue = gone !== undefined && gone.claim !== scanId ? shadow[key] : copyValue(shadow[key]);
        path!.push(key);
        tracker.emit({ action: "delete", path: path!.slice(), oldValue });
        path!.pop();
      }
      delete shadow[key];
    }
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const child = nodes === null ? undefined : nodes[index];
      const existed = hasOwn.call(shadow, key);
      const before = shadow[key];
      const after = child !== undefined ? child.shadow : copyValue(values[index]);
      if (emitting && !(existed && (child !== undefined ? oldChildren.get(key) === child : before === after))) {
        path!.push(key);
        if (existed) diffPlain(after, before, path!, tracker);
        else tracker.emit({ action: "set", path: path!.slice(), newValue: copyValue(after) });
        path!.pop();
      }
      shadow[key] = after;
    }
  }

  /** A scan threw: rebuild this node from the current state without events, then report. */
  fail(error: unknown): void {
    this.discardChildren();
    if (this.disposed) return;
    const path = this.path();
    this.shadow = undefined;
    try {
      this.firstScan();
    } catch {
      // The rebuild threw too (a getter that keeps throwing, a cycle): the next run tries again.
      this.discardChildren();
      this.shadow = undefined;
    }
    if (this.started) this.attachShadow();
    this.tracker.report(path, error);
  }

  /** Stops every child, also those a failed scan had already matched or made. */
  discardChildren(): void {
    for (const child of this.children.values()) child.dispose();
    if (this.pending !== null) for (const child of this.pending.values()) child.dispose();
    this.children = NO_CHILDREN;
    this.pending = null;
    this.rawIndex = null;
  }
}

function nodeKind(raw: object): NodeKind {
  if (Array.isArray(raw)) return "array";
  if (raw instanceof Map) return "map";
  if (raw instanceof Set) return "set";
  return "object";
}

function isNodeValue(value: unknown): value is object {
  return value !== null && typeof value === "object" && isReactive(value);
}

function indexByRaw(children: Map<Key, TrackedNode>): Map<object, TrackedNode[]> {
  const byRaw = new Map<object, TrackedNode[]>();
  for (const child of children.values()) {
    const list = byRaw.get(child.raw);
    if (list) list.push(child);
    else byRaw.set(child.raw, [child]);
  }
  return byRaw;
}

function typeTag(v: any): string {
  if (v === null || typeof v !== 'object') return 'primitive';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Map) return 'map';
  if (v instanceof Set) return 'set';
  if (v instanceof Date) return 'date';
  return 'object';
}

/**
 * Plain deep copy that reads raw objects only, so it tracks nothing. Used for
 * values that have no node (primitives, Dates, markRaw or frozen objects) and
 * for copies handed to events, which must not change when a node's copy does.
 */
function copyValue(value: any): any {
  if (value === null || typeof value !== "object") return value;
  const raw = toRaw(value);
  if (raw instanceof Date) return new Date(raw.getTime());
  if (Array.isArray(raw)) {
    const length = raw.length;
    const copy = new Array(length);
    for (let index = 0; index < length; index++) copy[index] = copyValue(raw[index]);
    return copy;
  }
  if (raw instanceof Map) {
    const copy = new Map();
    raw.forEach((entry, key) => copy.set(copyValue(key), copyValue(entry)));
    return copy;
  }
  if (raw instanceof Set) {
    const copy = new Set();
    raw.forEach((entry) => copy.add(copyValue(entry)));
    return copy;
  }
  const copy: Record<string, unknown> = {};
  const keys = Object.keys(raw);
  for (let index = 0; index < keys.length; index++) copy[keys[index]] = copyValue((raw as any)[keys[index]]);
  return copy;
}

/**
 * 2.0.0's diffAndClone event rules, applied to two plain trees: the old copy
 * and the copy of what now holds the slot. Object values in events are fresh
 * copies, so a later change to a node's copy never changes a sent event.
 */
function diffPlain(curr: any, old: any, path: Key[], tracker: Tracker): void {
  if (curr === null || typeof curr !== 'object') {
    // NaN equals NaN here: 2.0.0 sent every NaN leaf again on every walk.
    if (curr !== old && !(curr !== curr && old !== old)) {
      tracker.emit({ action: 'set', path: path.slice(), oldValue: copyValue(old), newValue: curr });
    }
    return;
  }

  const tag = typeTag(curr);
  if (tag !== typeTag(old)) {
    tracker.emit({ action: 'set', path: path.slice(), oldValue: copyValue(old), newValue: copyValue(curr) });
    return;
  }

  if (tag === 'date') {
    if (+curr !== +old) {
      tracker.emit({ action: 'set', path: path.slice(), oldValue: copyValue(old), newValue: new Date(+curr) });
    }
    return;
  }

  if (tag === 'array') {
    const min = Math.min(curr.length, old.length);
    for (let i = 0; i < min; i++) {
      path.push(i);
      diffPlain(curr[i], old[i], path, tracker);
      path.pop();
    }
    if (curr.length > old.length) {
      // Array grew: per-index sets only; a length event would leave a hole on the remote
      for (let i = old.length; i < curr.length; i++) {
        path.push(i);
        tracker.emit({ action: 'set', path: path.slice(), newValue: copyValue(curr[i]) });
        path.pop();
      }
    } else if (curr.length < old.length) {
      path.push('length');
      tracker.emit({ action: 'set', path: path.slice(), newValue: curr.length, oldValue: old.length });
      path.pop();
    }
    return;
  }

  if (tag === 'map' || tag === 'set') {
    diffCollection(curr, old, path.slice(), tracker);
    return;
  }

  for (const k of Object.keys(old)) {
    if (!hasOwn.call(curr, k)) {
      path.push(k);
      tracker.emit({ action: 'delete', path: path.slice(), oldValue: copyValue(old[k]) });
      path.pop();
    }
  }
  for (const k of Object.keys(curr)) {
    path.push(k);
    if (!hasOwn.call(old, k)) tracker.emit({ action: 'set', path: path.slice(), newValue: copyValue(curr[k]) });
    else diffPlain(curr[k], old[k], path, tracker);
    path.pop();
  }
}

/**
 * Deep equality of two copies. Unlike 2.0.0's deepEqual it tells Maps, Sets,
 * Dates, arrays and objects apart (deepEqual took an empty Map for `{}`, and
 * missed the change), and NaN equals NaN, as for leaves.
 */
function sameValue(a: any, b: any, seen: WeakMap<object, object> | undefined): boolean {
  if (a === b || (a !== a && b !== b)) return true;
  const tag = typeTag(a);
  if (tag === 'primitive' || tag !== typeTag(b)) return false;
  if (tag === 'date') return sameValue(+a, +b, seen);
  // Copies can hold cycles: a pair met again counts as equal.
  seen ??= new WeakMap();
  if (seen.get(a) === b) return true;
  seen.set(a, b);
  if (tag === 'array') {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i], seen)) return false;
    return true;
  }
  if (tag === 'map') {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !sameValue(v, b.get(k), seen)) return false;
    return true;
  }
  if (tag === 'set') {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) if (!hasOwn.call(b, k) || !sameValue(a[k], b[k], seen)) return false;
  return true;
}

/**
 * 2.0.0's Map and Set rules: whole-value events at the collection's own path.
 * Both sides are copies that no one changes later, so their values go out as is.
 */
function diffCollection(curr: Map<any, any> | Set<any>, old: Map<any, any> | Set<any>, path: Key[], tracker: Tracker): void {
  if (curr instanceof Map) {
    const before = old as Map<any, any>;
    for (const [k, v] of before) {
      if (!curr.has(k)) tracker.emit({ action: 'map-delete', path: path.slice(), key: k, oldValue: v });
    }
    for (const [k, v] of curr) {
      if (!before.has(k)) {
        tracker.emit({ action: 'map-set', path: path.slice(), key: k, newValue: v });
      } else if (!sameValue(v, before.get(k), undefined)) {
        tracker.emit({ action: 'map-set', path: path.slice(), key: k, newValue: v, oldValue: before.get(k) });
      }
    }
    return;
  }
  for (const v of old) {
    if (!curr.has(v)) tracker.emit({ action: 'set-delete', path: path.slice(), value: v, oldValue: v });
  }
  for (const v of curr) {
    if (!old.has(v)) tracker.emit({ action: 'set-add', path: path.slice(), value: v });
  }
}
