import { beginAsyncDelivery, emitListener, endAsyncDelivery, isRefusal, listenerGeneration, writeGeneration } from "./listener";
import { EmitFunction, Path, ReactiveOptions, StateEvent } from "./types";
import {
  Named,
  SnapshotLimitError,
  cloneStored,
  copiedFresh,
  deepEqual,
  globalSeen,
  hasOwn,
  isEnumerable,
  proxyStats,
  setData,
  toRaw,
  unwrapForStore,
} from "./utils";
import {
  Copied,
  LocationNode,
  adoptRoot,
  attachValue,
  copyPayload,
  detachPlace,
  dispatch,
  ensureLocationNode,
  evictDeep,
  getLocationNode,
  heldItems,
  locate,
  noteHidden,
  accessorMayBeGone,
  unsent,
  replacedInTree,
  definedAccessorFlags,
  notePlace,
  restoreEvicted,
  copyPayloadReaching,
  shallowCopy,
  forwardsTo,
  definedOver,
  definesFlagsAlone,
  inheritedSetter,
  ownDescriptor,
  refusedDefine,
} from "./location";
import { wrapArray } from "./wrap-array";
import { wrapMap } from "./wrap-map";
import { wrapSet } from "./wrap-set";
import { beginWrite, endWrite, track, trigger, triggerKeyChange, writeThroughSetter } from "./watch-effect";
import { ReactiveFlags } from "./constants";

// avoid repeated typeof checks
function isObject(v: any): v is object {
  return v && typeof v === "object";
}

/**
 * Checks if an object is a reactive proxy
 */
export function isReactive(value: any): boolean {
  return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}


/**
 * Wraps an emit function to defer calls to the next microtask.
 * Multiple events queued in the same synchronous tick are flushed
 * in order on a single microtask. An emit that throws does not stop the
 * others: every queued event, including nested writes, is delivered.
 * Then the microtask throws the first error. Each event keeps the
 * generation it was sent with (see `emitListener`). The microtask is one
 * operation of listener writes; it logs the bound's error, which no
 * caller would receive, instead of throwing it.
 */
function createAsyncEmit(emit: EmitFunction): EmitFunction {
  const queue: StateEvent[] = []
  const generations: number[] = []
  let flushScheduled = false

  return (event: StateEvent) => {
    queue.push(event)
    // the wrapper is called as the root's listener, with the event's generation
    generations.push(listenerGeneration())
    if (!flushScheduled) {
      flushScheduled = true
      queueMicrotask(() => {
        let failed = false
        let failure: unknown
        let next = 0
        beginAsyncDelivery()
        try {
        while (next < queue.length) {
          try {
            const index = next++
            emitListener(emit, queue[index], generations[index])
          } catch (error) {
            if (!failed && !isRefusal(error)) {
              failed = true
              failure = error
            }
          }
          // a flush that listeners keep growing lets go of what it delivered
          if (next === FLUSH_CHUNK) {
            queue.splice(0, next)
            generations.splice(0, next)
            next = 0
          }
        }
        } finally {
          queue.length = 0
          generations.length = 0
          flushScheduled = false
          endAsyncDelivery()
        }
        if (failed) throw failure
      })
    }
  }
}

/** Is `descriptor` a value alone, as a plain write to a key the object has defines it? */
function valueOnly(descriptor: PropertyDescriptor): boolean {
  return !("writable" in descriptor) && !("enumerable" in descriptor) && !("configurable" in descriptor);
}

/** Delivered events an async flush keeps before it drops them from its queue. */
const FLUSH_CHUNK = 1024

/**
 * Create a reactive proxy for an object.
 *
 * Called by users, this makes a root: events from anywhere below it go to
 * `emit`, with paths that start with `path`. Nested objects are wrapped on
 * read by `wrapChild`.
 */
export function reactive<T extends object>(
  obj: T,
  emit?: EmitFunction,
  path: Path = [],
  options?: ReactiveOptions
): T {
  // If the object is explicitly marked as raw, return it as-is without wrapping.
  if ((obj as any)[ReactiveFlags.SKIP]) {
    return obj;
  }

  // one proxy per raw object
  const existing = globalSeen.get(obj);
  if (existing !== undefined) return existing;
  // a proxy is never wrapped again: `emit` and `path` are ignored, and the
  // proxy keeps emitting to its own root
  if ((obj as any)[ReactiveFlags.IS_REACTIVE]) return obj;

  // At the root call, wrap emit with async batching if requested.
  // Every location under this root emits through the wrapped function.
  if (emit && path.length === 0 && options?.async) {
    emit = createAsyncEmit(emit)
  }

  // if this is the root call (path is empty) and an emit function is provided,
  // emit the initial state event, with a copy like every stored value: a
  // listener may keep it as its replica and apply the later events to it,
  // which must not write into `obj`. 1.0.44 sent `obj` itself, so the copy
  // keeps every data property it has, also named properties of arrays. A
  // value too large to copy (see SNAPSHOT_SHARED_COPY_LIMIT) throws here,
  // before the root has a proxy.
  let fresh = false;
  if (emit && path.length === 0) {
    try {
      const newValue = cloneStored(obj, undefined, Named.All);
      fresh = copiedFresh;
      emitListener(emit, { action: "replace", path: [], newValue }, writeGeneration());
    } catch (error) {
      if (error instanceof SnapshotLimitError) throw error;
      console.error("Failed to emit initial reactive state:", error);
    }
  }

  const node = ensureLocationNode(obj);
  node.root = { emit, path, async: emit !== undefined && options?.async === true, undelivered: undefined };
  node.scope = node.root;
  // an object at two places in the initial value emits to both from the
  // start; a fresh value has no such object (see `cloneStored`)
  if (emit && !fresh) adoptRoot(node);
  return createProxy(obj, node, options);
}

/**
 * The proxy for `raw`, which a read found at `parent[key]`. Records that
 * place, so the proxy's events name where the object is now.
 * @internal
 */
export function wrapChild(
  raw: any,
  parent: LocationNode,
  key: unknown,
  options?: ReactiveOptions
): any {
  let node = getLocationNode(raw);
  if (node !== undefined && node.proxy !== undefined) {
    // proxied before, so it passed the checks below then: one map lookup
    notePlace(node, parent, key);
    node.scope ??= parent.scope;
    return node.proxy;
  }
  if (raw[ReactiveFlags.SKIP]) return raw;
  // a proxy the state holds where a store could not put its raw object (a
  // frozen object, a getter) stands for that object: never wrap it again
  if (raw[ReactiveFlags.IS_REACTIVE]) return wrapChild(toRaw(raw), parent, key, options);
  if (raw instanceof Date) return new Date(raw.getTime()); // dates are not proxied, return copy
  node ??= ensureLocationNode(raw);
  notePlace(node, parent, key);
  node.scope ??= parent.scope;
  return restoreEvicted(node) ?? createProxy(raw, node, options);
}

/**
 * The proxy for an object that has no place of its own (a map key).
 * @internal
 */
export function wrapUnplaced(raw: any): any {
  if (raw[ReactiveFlags.SKIP]) return raw;
  const existing = globalSeen.get(raw);
  if (existing !== undefined) return existing;
  // a map key that is a proxy stands for its raw object
  if (raw[ReactiveFlags.IS_REACTIVE]) return wrapUnplaced(toRaw(raw));
  const node = ensureLocationNode(raw);
  return restoreEvicted(node) ?? createProxy(raw, node);
}

function createProxy(raw: any, node: LocationNode, options?: ReactiveOptions): any {
  const proxy = Array.isArray(raw)
    ? wrapArray(raw, node)
    : raw instanceof Map
      ? wrapMap(raw, node)
      : raw instanceof Set
        ? wrapSet(raw, node)
        : wrapObject(raw, node, options);
  node.proxy = proxy;
  return proxy;
}

/**
 * The descriptor of a define that the `defineProperty` trap hands to `set`.
 * `set` takes it as its first step, and nothing runs between the store and
 * that read, so one slot serves every object proxy. A fifth parameter of
 * `set` would cost every write an arity fixup, which is about as much as
 * the equal-value check.
 */
let defining: PropertyDescriptor | undefined;

/**
 * The handler of one object proxy. Its traps are shared by every object
 * proxy, and the fields are all a proxy holds of its own. Until 3.0.19 each
 * proxy had its own handler with four closures, about 400 bytes.
 */
class ObjectHandler<T extends object> {
  node: LocationNode;
  options: ReactiveOptions | undefined;
  proxy: T | undefined;

  constructor(node: LocationNode, options: ReactiveOptions | undefined) {
    this.node = node;
    this.options = options;
    this.proxy = undefined;
  }

  get(target: T, prop: string | symbol, receiver: any): any {
    // Special handling for reactive flags
    if (prop === ReactiveFlags.RAW) {
      return target;
    }
    if (prop === ReactiveFlags.IS_REACTIVE) {
      return true;
    }

    const value = Reflect.get(target, prop, receiver);

    // track property access for dependency tracking
    track(target, prop);

    // return non-objects directly without wrapping
    if (!isObject(value)) return value;

    // wrap the nested value if it's an object/collection
    return wrapChild(value, this.node, prop, this.options);
  }

  set(target: T, prop: string | symbol, value: any, receiver: any): boolean {
    // the write is `Object.defineProperty` with this descriptor (see below)
    const descriptor = defining;
    if (descriptor !== undefined) defining = undefined;
    const node = this.node;
    const proxy = this.proxy;
    const options = this.options;
    const had = hasOwn.call(target, prop);
    // the key's descriptor, unless the object has no accessor (see `ownDescriptor`)
    const current = had && node.dataOnly !== true ? ownDescriptor(target, prop, node) : undefined;
    const setter = had ? (current !== undefined && current.set !== undefined ? current : undefined) : inheritedSetter(target, prop);
    // Another receiver (an outer proxy of any kind, another proxy as
    // `Reflect.set`'s receiver, `Object.create(proxy)`, the raw object)
    // gets the ordinary write, as on a plain object. When the write lands
    // on this object, it ends in the `defineProperty` trap below, which
    // sends it once; on any other object it sends nothing here. A write
    // that calls a setter goes on below, on every route. Every trap of the
    // receiver runs on every write, as on a plain object.
    if (receiver !== proxy && setter === undefined) return Reflect.set(target, prop, value, receiver);

    // Spreading a reactive proxy (`{ ...proxy }`) embeds proxy wrappers
    // in the plain result — unwrap to prevent unbounded nesting.
    if (isObject(value)) value = unwrapForStore(value);

    // a define, like `Object.defineProperty`, calls no getter (see `definedOver`)
    const oldValue = descriptor === undefined ? (target as any)[prop] : definedOver(target, prop, had, current);

    // A setter, own or inherited, as on an array (see `writeThroughSetter`).
    // A write that lands on the object changes nothing when the getter
    // already gives the value; a setter with no getter always runs. A
    // receiver that does not forward (`Object.create(obj)`, the raw
    // object) runs the setter as on a plain object. A define with a value
    // makes the key data: it is written below.
    if (setter !== undefined && descriptor === undefined) {
      const forwards = receiver === proxy || forwardsTo(receiver, target);
      if (
        forwards &&
        setter.get !== undefined &&
        (oldValue === value ||
          (!options?.async && isObject(oldValue) && isObject(value) && deepEqual(oldValue, value)))
      )
        return true;
      return writeThroughSetter(target, prop, value, receiver, forwards, oldValue);
    }

    // A replica holds the enumerable string keys alone, as JSON does:
    // `shownBefore` and `shown`, whether it holds the key before and
    // after the write. A write by `=` keeps a key the object has as it
    // was, and adds a new one enumerable; a define sets what its
    // descriptor says. With no descriptor, the key is data, and the
    // object's hidden keys tell (see `hidden`). A symbol key counts as
    // shown here, and `locate` sends nothing for it: a check here would
    // cost every write.
    const shownBefore = had && (current === undefined ? node.hidden?.has(prop) !== true : current.enumerable === true);
    let shown = had ? shownBefore : true;
    if (descriptor !== undefined) {
      shown = "enumerable" in descriptor ? descriptor.enumerable === true : shownBefore;
      if (refusedDefine(target, prop, value, descriptor, current)) return false;
    }

    // avoid unnecessary triggers if the value hasn't changed. An inherited
    // value is not the object's own: writing it adds the key, and a
    // replica that copies own keys needs the event. Deep equality is
    // skipped when async emit is enabled because the cost of a redundant
    // deferred emit is far less than a synchronous deep comparison on
    // every property set. A define of the same value sets its flags
    // alone, unless it shows or hides the key (see `definesFlagsAlone`).
    if (
      had &&
      (oldValue === value || (!options?.async && isObject(oldValue) && isObject(value) && deepEqual(oldValue, value))) &&
      (descriptor === undefined ||
        (shown === shownBefore && definesFlagsAlone(target, prop, oldValue, value, descriptor, current)))
    )
      return descriptor === undefined || Reflect.defineProperty(target, prop, { ...descriptor, value: oldValue });

    // the write does not move `target`, so its paths are known before it.
    // A hidden key is written and its effects rerun, with no event, so it
    // needs no paths; a key a define hides is deleted from the replica.
    const sent = shown || shownBefore;
    const located = sent ? locate(node, prop) : unsent(node);
    const event: StateEvent | undefined =
      located === undefined
        ? undefined
        : shown
          ? { action: "set", path: located.paths[0], oldValue, newValue: value }
          : { action: "delete", path: located.paths[0], oldValue };
    const held = located && heldItems(value, oldValue);
    // copies the payload, or throws, before the write
    const copied = copyPayload(event, located, target, held);
    if (copied === Copied.Reaches) {
      // the payload reaches `target`: copy it with the write made on a copy of `target`
      const after = shallowCopy(target);
      if (shown) setData(after, prop, value);
      else delete after[prop];
      copyPayloadReaching(event!, located!, target, after);
    }
    // The write goes to the target: through the proxy it would end in the
    // proxy's `defineProperty` trap. A define keeps its descriptor unless
    // the value was unwrapped.
    // A define of the value alone on a key the object has as enumerable data is that write.
    const result =
      descriptor === undefined
        ? Reflect.set(target, prop, value)
        : (had && current === undefined && valueOnly(descriptor) && Reflect.set(target, prop, value)) ||
          Reflect.defineProperty(target, prop, descriptor.value === value ? descriptor : { ...descriptor, value });

    // only emit and trigger if the set was successful
    if (result) {
      // a define may add a hidden key, or show or hide one
      if (descriptor !== undefined && !(shown && shownBefore)) noteHidden(node, prop, !shown);
      // move places before anything can write again (emit may throw)
      if (isObject(oldValue)) detachPlace(oldValue, node, prop);
      if (isObject(value))
        attachValue(value, node, prop, copied === Copied.Fresh, sent ? located && oldValue : replacedInTree(node, oldValue), held);

      beginWrite();
      try {
        if ((!had && hasOwn.call(target, prop)) || shown !== shownBefore) triggerKeyChange(target);
        else if (oldValue === oldValue || value === value) trigger(target, prop);
        if (event !== undefined) dispatch(located!, event);
      } finally {
        try {

          // Evict the old object tree from proxy caches so GC can collect
          // stale proxies and their methodCache closures. A part of it that
          // still sits in the tree keeps its proxy.
          if (isObject(oldValue)) {
            evictDeep(oldValue);
          }
        } finally {
          endWrite();
        }
      }
    }
    return result;
  }

  deleteProperty(target: T, prop: string | symbol): boolean {
    const node = this.node;
    const oldValue = (target as any)[prop];
    // an own enumerable key, the one a replica holds (see `set`; `locate`
    // sends nothing for a symbol key): one lookup for it, a second only
    // for a hidden key
    const shown = isEnumerable.call(target, prop);
    const hadProperty = shown || hasOwn.call(target, prop);
    const located = shown ? locate(node, prop) : undefined;
    const event: StateEvent | undefined = located && {
      action: "delete",
      path: located.paths[0],
      oldValue,
    };
    if (copyPayload(event, located, target) === Copied.Reaches) {
      const after = shallowCopy(target);
      delete after[prop];
      copyPayloadReaching(event!, located!, target, after);
    }
    const result = Reflect.deleteProperty(target, prop);

    // only emit and trigger if the property existed and deletion was successful
    if (hadProperty && result) {
      if (!shown) noteHidden(node, prop, false);
      accessorMayBeGone(node, true);
      if (isObject(oldValue)) detachPlace(oldValue, node, prop);

      beginWrite();
      try {
        triggerKeyChange(target);
        if (event !== undefined) dispatch(located!, event);
      } finally {
        try {

          // Recursively evict stale proxy for deleted value
          if (isObject(oldValue)) {
            evictDeep(oldValue);
          }
        } finally {
          endWrite();
        }
      }
    }

    return result;
  }

  defineProperty(target: T, prop: string | symbol, descriptor: PropertyDescriptor): boolean {
    const node = this.node;
    // A value is written as `set` writes it: the same event, and the same
    // effects rerun. A write through another receiver that lands on this
    // object ends here (an outer proxy, with any traps that do not
    // replace the write, or this proxy as `Reflect.set`'s receiver).
    // Until 3.0.15 an object proxy had no such trap: those writes
    // changed the object and sent nothing.
    if ("value" in descriptor) {
      defining = descriptor;
      return accessorMayBeGone(node, this.set(target, prop, descriptor.value, this.proxy));
    }
    if (!("get" in descriptor) && !("set" in descriptor)) {
      // new flags alone on a key the object has change no value
      // (`Object.freeze` ends here for each key), unless `writable` makes
      // an accessor a data property, or `enumerable` shows or hides the
      // key: then it is the define of the value it holds
      const current = Reflect.getOwnPropertyDescriptor(target, prop);
      if (current !== undefined && "value" in current) {
        if (!("enumerable" in descriptor) || (descriptor.enumerable === true) === current.enumerable)
          return Reflect.defineProperty(target, prop, descriptor);
        defining = { ...descriptor, value: current.value };
        return this.set(target, prop, current.value, this.proxy);
      }
      if (current !== undefined && !("writable" in descriptor)) return definedAccessorFlags(node, target, prop, descriptor);
      // a new key, or an accessor made data: a write of `undefined`
      defining = descriptor;
      return accessorMayBeGone(node, this.set(target, prop, undefined, this.proxy));
    }
    // an accessor: effects rerun, and no event is sent
    // (an accessor added later is outside the supported input, see `ownDescriptor`)
    const had = hasOwn.call(target, prop);
    const result = Reflect.defineProperty(target, prop, descriptor);
    if (result) {
      if (node.dataOnly === true) node.dataOnly = false;
      noteHidden(node, prop, !isEnumerable.call(target, prop));
      beginWrite();
      try {
        if (!had) triggerKeyChange(target);
        else trigger(target, prop);
      } finally {
        endWrite();
      }
    }
    return result;
  }
}

function wrapObject<T extends object>(obj: T, node: LocationNode, options?: ReactiveOptions): T {
  const handler = new ObjectHandler<T>(node, options);
  const proxy: T = new Proxy(obj, handler);
  handler.proxy = proxy;

  // cache the proxy to handle circular references and improve performance
  globalSeen.set(obj, proxy);
  proxyStats.created++;
  proxyStats.objects++;
  return proxy;
}
