import { EmitFunction, Path, ReactiveOptions, StateEvent } from "./types";
import { SnapshotLimitError, cloneTree, deepEqual, globalSeen, proxyStats, unwrapForStore } from "./utils";
import {
  LocationNode,
  adoptRoot,
  attachValue,
  copyPayload,
  detachPlace,
  dispatch,
  ensureLocationNode,
  evictDeep,
  getLocationNode,
  locate,
  notePlace,
  restoreEvicted,
  copyPayloadAfter,
  setData,
  shallowCopy,
} from "./location";
import { wrapArray } from "./wrap-array";
import { wrapMap } from "./wrap-map";
import { wrapSet } from "./wrap-set";
import { track, trigger } from "./watch-effect";
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
 * in order on a single microtask.
 */
function createAsyncEmit(emit: EmitFunction): EmitFunction {
  const queue: StateEvent[] = []
  let flushScheduled = false

  return (event: StateEvent) => {
    queue.push(event)
    if (!flushScheduled) {
      flushScheduled = true
      queueMicrotask(() => {
        flushScheduled = false
        const batch = queue.splice(0)
        for (const queuedEvent of batch) {
          emit(queuedEvent)
        }
      })
    }
  }
}

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

  // At the root call, wrap emit with async batching if requested.
  // Every location under this root emits through the wrapped function.
  if (emit && path.length === 0 && options?.async) {
    emit = createAsyncEmit(emit)
  }

  // if this is the root call (path is empty) and an emit function is provided,
  // emit the initial state event, with a copy like every other event. A
  // value too large to copy (see SNAPSHOT_SHARED_COPY_LIMIT) throws here,
  // before the root has a proxy.
  if (emit && path.length === 0) {
    try {
      const initialEvent: StateEvent = {
        action: "replace",
        path: [],
        newValue: cloneTree(obj),
      };
      emit(initialEvent);
    } catch (error) {
      if (error instanceof SnapshotLimitError) throw error;
      console.error("Failed to emit initial reactive state:", error);
    }
  }

  const node = ensureLocationNode(obj);
  node.root = { emit, path };
  node.scope = node.root;
  // an object at two places in the initial value emits to both from the start
  if (emit) adoptRoot(node);
  return createProxy(obj, node, options);
}

/**
 * The proxy for `raw`, which a read found at `parent[key]`. Records that
 * place, so the proxy's events name where the object is now.
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
  if (raw instanceof Date) return new Date(raw.getTime()); // dates are not proxied, return copy
  node ??= ensureLocationNode(raw);
  notePlace(node, parent, key);
  node.scope ??= parent.scope;
  return restoreEvicted(node) ?? createProxy(raw, node, options);
}

/** The proxy for an object that has no place of its own (a map key). */
export function wrapUnplaced(raw: any): any {
  if (raw[ReactiveFlags.SKIP]) return raw;
  const existing = globalSeen.get(raw);
  if (existing !== undefined) return existing;
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

      // avoid unnecessary triggers if the value hasn't changed
      // fast path for primitives
      if (oldValue === value) return true;
      // deep equality check for objects/arrays — skip when async emit is
      // enabled because the cost of a redundant deferred emit is far less
      // than a synchronous deep comparison on every property set
      if (
        !options?.async &&
        isObject(oldValue) &&
        isObject(value) &&
        deepEqual(oldValue, value)
      )
        return true;

      // an own setter makes its own writes; the set itself emits nothing
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const emits = !descriptor || !descriptor.set;
      // the write does not move `target`, so its paths are known before it
      const located = emits ? locate(node, prop) : undefined;
      const event: StateEvent | undefined = located && {
        action: "set",
        path: located.paths[0],
        oldValue,
        newValue: value,
      };
      // copies the payload, or throws, before the write
      if (!copyPayload(event, target)) {
        // the payload reaches `target`: copy it with the write made on a copy of `target`
        const after = shallowCopy(target);
        // a non-enumerable property stays out of copies, written or not
        if (descriptor === undefined || descriptor.enumerable) setData(after, prop, value);
        copyPayloadAfter(event!, target, after);
      }
      const result = Reflect.set(target, prop, value, receiver);

      // only emit and trigger if the set was successful and wasn't intercepted by a setter
      if (result && emits) {
        // move places before anything can write again (emit may throw)
        if (isObject(oldValue)) detachPlace(oldValue, node, prop);
        if (isObject(value)) attachValue(value, node, prop);

        if (event !== undefined) dispatch(located!, event);

        // notify effects watching this property
        trigger(target, prop);

        // Evict the old object tree from proxy caches so GC can collect
        // stale proxies and their methodCache closures. A part of it that
        // still sits in the tree keeps its proxy.
        if (isObject(oldValue)) {
          evictDeep(oldValue);
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
      if (!copyPayload(event, target)) {
        const after = shallowCopy(target);
        delete after[prop];
        copyPayloadAfter(event!, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);

      // only emit and trigger if the property existed and deletion was successful
      if (hadProperty && result) {
        if (isObject(oldValue)) detachPlace(oldValue, node, prop);

        if (event !== undefined) dispatch(located!, event);

        // notify effects watching this property
        trigger(target, prop);

        // Recursively evict stale proxy for deleted value
        if (isObject(oldValue)) {
          evictDeep(oldValue);
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
