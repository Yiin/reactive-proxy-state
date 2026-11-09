import { beginAsyncDelivery, emitListener, endAsyncDelivery, isRefusal, listenerGeneration } from "./listener";
import { EmitFunction, Path, ReactiveOptions, StateEvent } from "./types";
import {
  Named,
  SnapshotLimitError,
  cloneStored,
  copiedFresh,
  deepEqual,
  globalSeen,
  hasOwn,
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
  notePlace,
  restoreEvicted,
  copyPayloadReaching,
  shallowCopy,
  writesThroughSetter,
} from "./location";
import { wrapArray } from "./wrap-array";
import { wrapMap } from "./wrap-map";
import { wrapSet } from "./wrap-set";
import { beginWrite, endWrite, track, trigger, triggerKeyChange } from "./watch-effect";
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
    generations.push(listenerGeneration)
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
      emitListener(emit, { action: "replace", path: [], newValue }, listenerGeneration + 1);
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

function wrapObject<T extends object>(obj: T, node: LocationNode, options?: ReactiveOptions): T {
  const proxy = new Proxy(obj, {
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
      return wrapChild(value, node, prop, options);
    },
    set(target: T, prop: string | symbol, value: any, receiver: any): boolean {
      // Spreading a reactive proxy (`{ ...proxy }`) embeds proxy wrappers
      // in the plain result — unwrap to prevent unbounded nesting.
      if (isObject(value)) value = unwrapForStore(value);

      const oldValue = (target as any)[prop];

      // avoid unnecessary triggers if the value hasn't changed. An inherited
      // value is not the object's own: writing it adds the key, and a
      // replica that copies own keys needs the event
      // fast path for primitives
      if (oldValue === value && hasOwn.call(target, prop)) return true;
      // deep equality check for objects/arrays — skip when async emit is
      // enabled because the cost of a redundant deferred emit is far less
      // than a synchronous deep comparison on every property set
      if (
        !options?.async &&
        isObject(oldValue) &&
        isObject(value) &&
        hasOwn.call(target, prop) &&
        deepEqual(oldValue, value)
      )
        return true;

      // an own setter makes its own writes; the set itself emits nothing
      const emits = !writesThroughSetter(target, prop, node);
      // the write does not move `target`, so its paths are known before it
      const located = emits ? locate(node, prop) : undefined;
      const event: StateEvent | undefined = located && {
        action: "set",
        path: located.paths[0],
        oldValue,
        newValue: value,
      };
      const held = located && heldItems(value, oldValue);
      // copies the payload, or throws, before the write
      const copied = copyPayload(event, located, target, held);
      if (copied === Copied.Reaches) {
        // the payload reaches `target`: copy it with the write made on a copy of `target`
        const after = shallowCopy(target);
        // a non-enumerable property stays out of copies, written or not
        const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor === undefined || descriptor.enumerable) setData(after, prop, value);
        copyPayloadReaching(event!, located!, target, after);
      }
      const had = hasOwn.call(target, prop);
      const result = Reflect.set(target, prop, value, receiver);

      // only emit and trigger if the set was successful and wasn't intercepted by a setter
      if (result && emits) {
        // move places before anything can write again (emit may throw)
        if (isObject(oldValue)) detachPlace(oldValue, node, prop);
        if (isObject(value)) attachValue(value, node, prop, copied === Copied.Fresh, located && oldValue, held);

        beginWrite();
        try {
          if (!had && hasOwn.call(target, prop)) triggerKeyChange(target);
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
    },
    deleteProperty(target: T, prop: string | symbol): boolean {
      const oldValue = (target as any)[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
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
    },
  });

  // cache the proxy to handle circular references and improve performance
  globalSeen.set(obj, proxy);
  proxyStats.created++;
  proxyStats.objects++;
  return proxy;
}
