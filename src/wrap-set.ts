import { collectionMember, forgetReplicaIndex, hasOwn, indexAdded, indexRemoved, newMethodCache, unwrapForStore, watchIndex, wrapperCache, globalSeen, proxyStats } from "./utils";
import { wrapChild } from "./reactive";
import {
  Copied,
  LocationNode,
  attachValue,
  copyPayload,
  detachPlace,
  dispatch,
  evictDeep,
  locate,
  copyPayloadReaching,
  shallowCopy,
} from "./location";
import type { StateEvent } from "./types";
import { activeEffect, trackingVersion, beginWrite, endWrite, track, trackEntry, triggerCleared, triggerCollection } from "./watch-effect";
import { ReactiveFlags } from "./constants";

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

/** The set methods that read every value of their set. */
const setReaders = new Set<string | symbol>([
  "union",
  "intersection",
  "difference",
  "symmetricDifference",
  "isSubsetOf",
  "isSupersetOf",
  "isDisjointFrom",
]);

class SetProxyIterator<T> {
  private target: Set<T> | undefined;
  private trackedAt = -1;
  private readonly iterator: SetIterator<T>;

  constructor(target: Set<T>, private readonly node: LocationNode, private readonly entries: boolean) {
    this.target = target;
    this.iterator = target.values();
  }

  next(): IteratorResult<unknown> {
    if (this.target === undefined) return { value: undefined, done: true };
    if (activeEffect !== null && this.trackedAt !== trackingVersion) {
      track(this.target, Symbol.iterator);
      this.trackedAt = trackingVersion;
    }
    const step = this.iterator.next();
    if (step.done) {
      this.target = undefined;
      return step;
    }
    if (isObject(step.value)) step.value = wrapChild(step.value, this.node, undefined);
    if (this.entries) return { value: [step.value, step.value], done: false };
    return step;
  }
}

Object.setPrototypeOf(
  SetProxyIterator.prototype,
  Object.getPrototypeOf(Object.getPrototypeOf(new Set().values()))
);

export function wrapSet<T>(set: Set<T>, node: LocationNode): Set<T> {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy) return cachedProxy as Set<T>;
  if (globalSeen.has(set)) return globalSeen.get(set);

  const methodCache = newMethodCache();
  // the proxy keeps the collection's index by token, once it has one
  const watch = watchIndex(set);

  const proxy = new Proxy(set, {
    get(target: Set<T>, prop: string | symbol, receiver: any): any {
      if (prop === ReactiveFlags.RAW) return target;
      if (prop === ReactiveFlags.IS_REACTIVE) return true;

      // methods track what they read when they run, not when they are read:
      // until 3.0.2 `const values = set.values` before an effect gave values
      // that tracked nothing
      const cached = methodCache[prop];
      if (cached !== undefined) return cached;
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      // an own property in place of a method is read as it is
      if (hasOwn.call(target, prop)) return collectionMember(target, prop, Reflect.get(target, prop, receiver));

      if (prop === "add") {
        methodCache[prop] = function (value: T): Set<T> {
          if (value != null && typeof value === 'object') value = unwrapForStore(value) as T;
          const existed = target.has(value);
          const oldSize = target.size;

          if (!existed) {
            // the write does not move `target`, so its paths are known before it
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "set-add",
              path: located.paths[0],
              value: value,
            };
            // copies the payload, or throws, before the write
            const copied = copyPayload(event, located, target);
            if (copied === Copied.Reaches) {
              copyPayloadReaching(event!, located!, target, shallowCopy(target).add(value));
            }
            target.add(value);
            const newSize = target.size;
            if (watch.indexed) indexAdded(target, value);

            if (isObject(value)) attachValue(value, node, undefined, copied === Copied.Fresh);
            beginWrite();
            try {
              triggerCollection(target, value, oldSize !== newSize);
              if (event !== undefined) dispatch(located!, event);
            } finally {
              endWrite();
            }
          }
          return receiver;
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function (value: T): boolean {
          const existed = target.has(value);
          const oldSize = target.size;

          if (existed) {
            const oldValue = value;
            const located = locate(node);
            const event: StateEvent | undefined = located && {
              action: "set-delete",
              path: located.paths[0],
              value: value,
              oldValue: oldValue,
            };
            if (copyPayload(event, located, target) === Copied.Reaches) {
              const after = shallowCopy(target);
              after.delete(value);
              copyPayloadReaching(event!, located!, target, after);
            }
            const result = target.delete(value);
            const newSize = target.size;

            if (result) {
              if (watch.indexed) indexRemoved(target, value);
              if (isObject(value)) detachPlace(value, node, undefined);
              beginWrite();
              try {
                triggerCollection(target, value, oldSize !== newSize);
                if (event !== undefined) dispatch(located!, event);
              } finally {
                try {
                  if (isObject(value)) evictDeep(value);
                } finally {
                  endWrite();
                }
              }
            }
            return result;
          }
          return false;
        };
        return methodCache[prop];
      }
      if (prop === "clear") {
        methodCache[prop] = function (): void {
          const oldSize = target.size;
          if (oldSize === 0) return;

          const located = locate(node);
          const removed = [...target];
          target.clear();
          if (watch.indexed) forgetReplicaIndex(target);

          for (const member of removed) {
            if (isObject(member)) detachPlace(member, node, undefined);
          }
          beginWrite();
          try {
            triggerCleared(target, removed);
            if (located !== undefined) {
              dispatch(located, {
                action: "set-clear",
                path: located.paths[0],
                value: null,
              });
            }
          } finally {
            try {
              for (const member of removed) {
                if (isObject(member)) evictDeep(member);
              }
            } finally {
              endWrite();
            }
          }
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        methodCache[prop] = function (value: T): boolean {
          trackEntry(target, value);
          return target.has(value);
        }.bind(target);
        return methodCache[prop];
      }
      if (
        prop === "values" ||
        prop === Symbol.iterator ||
        prop === "entries" ||
        prop === "keys" ||
        prop === "forEach"
      ) {
        if (prop === "forEach") {
          methodCache[prop] = (
            callbackfn: (value: T, value2: T, set: Set<T>) => void,
            thisArg?: any
          ): void => {
            const valuesIterator = proxy.values();
            for (const value of valuesIterator) {
              callbackfn.call(thisArg, value, value, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function () {
          return new SetProxyIterator(target, node, prop === "entries");
        };
        return methodCache[prop];
      }
      // Forward constructor property for instanceof checks
      if (prop === "constructor") {
        return Set;
      }

      const value = Reflect.get(target, prop, receiver);
      // `union`, `isSubsetOf` and the other set methods read every value
      // (Set.prototype's own: a polyfill elsewhere is read again each time)
      if (typeof value === "function" && setReaders.has(prop) && hasOwn.call(Set.prototype, prop) && (Set.prototype as any)[prop] === value) {
        methodCache[prop] = function (this: unknown) {
          track(target, Symbol.iterator);
          return value.apply(target, arguments);
        };
        return methodCache[prop];
      }
      return collectionMember(target, prop, value);
    },
    defineProperty(target: Set<T>, prop: string | symbol, descriptor: PropertyDescriptor): boolean {
      // `set.add = fn` ends here too. The set's own properties are no values:
      // no effect reads them and no event sends them.
      const result = Reflect.defineProperty(target, prop, descriptor);
      // the new own property is read from now on
      if (result && methodCache[prop] !== undefined) methodCache[prop] = undefined;
      return result;
    },
  });

  globalSeen.set(set, proxy);
  wrapperCache.set(set, proxy);
  proxyStats.created++;
  proxyStats.sets++;
  return proxy;
}
