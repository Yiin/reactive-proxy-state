var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/index.ts
var exports_src = {};
__export(exports_src, {
  writeThroughSetter: () => writeThroughSetter,
  watchEffect: () => watchEffect,
  watch: () => watch,
  updateState: () => updateState,
  unref: () => unref,
  triggerSplice: () => triggerSplice,
  triggerRef: () => triggerRef,
  triggerKeyChange: () => triggerKeyChange,
  triggerCollection: () => triggerCollection,
  triggerCleared: () => triggerCleared,
  triggerArray: () => triggerArray,
  trigger: () => trigger,
  trackingVersion: () => trackingVersion,
  trackVueReactiveEvents: () => trackVueReactiveEvents,
  trackMembership: () => trackMembership,
  trackMapValues: () => trackMapValues,
  trackMapKeys: () => trackMapKeys,
  trackKeys: () => trackKeys,
  trackEntry: () => trackEntry,
  track: () => track,
  toRefs: () => toRefs,
  toRef: () => toRef,
  toRaw: () => toRaw,
  setActiveEffect: () => setActiveEffect,
  runCleanupFunctions: () => runCleanupFunctions,
  resetProxyStats: () => resetProxyStats,
  ref: () => ref,
  reactive: () => reactive,
  markRaw: () => markRaw,
  isRefSymbol: () => isRefSymbol,
  isRef: () => isRef,
  isReactive: () => isReactive,
  isComputed: () => isComputed,
  getProxyStats: () => getProxyStats,
  flushing: () => flushing,
  endWrite: () => endWrite,
  dependencyCounts: () => dependencyCounts,
  deepToRaw: () => deepToRaw,
  deepEqual: () => deepEqual,
  deepClone: () => deepClone,
  createRendererBridgeEmitter: () => createRendererBridgeEmitter,
  createMainBridgeEmitter: () => createMainBridgeEmitter,
  createBridgeEmitter: () => createBridgeEmitter,
  computed: () => computed,
  cleanupEffect: () => cleanupEffect,
  beginWrite: () => beginWrite,
  batchDepth: () => batchDepth,
  activeEffect: () => activeEffect,
  UnsupportedStateError: () => UnsupportedStateError,
  SnapshotLimitError: () => SnapshotLimitError,
  SNAPSHOT_SHARED_COPY_LIMIT: () => SNAPSHOT_SHARED_COPY_LIMIT
});
module.exports = __toCommonJS(exports_src);

// src/utils.ts
function toRaw(observed) {
  let value = observed;
  while (value && value["__v_raw" /* RAW */]) {
    value = value["__v_raw" /* RAW */];
  }
  return value;
}
function unwrapForStore(value) {
  if (value["__v_isReactive" /* IS_REACTIVE */])
    return toRaw(value);
  if (Array.isArray(value)) {
    for (let i = 0;i < value.length; i++) {
      const child = value[i];
      if (child != null && typeof child === "object" && child["__v_isReactive" /* IS_REACTIVE */])
        storeRawChild(value, i, child);
    }
  } else if (!(value instanceof Map) && !(value instanceof Set) && !(value instanceof Date)) {
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key))
        continue;
      const child = value[key];
      if (child != null && typeof child === "object" && child["__v_isReactive" /* IS_REACTIVE */])
        storeRawChild(value, key, child);
    }
  }
  return value;
}
var lookupSetter = Object.prototype.__lookupSetter__;
function storeRawChild(value, key, child) {
  if (lookupSetter === undefined) {
    if (Reflect.getOwnPropertyDescriptor(value, key)?.value === child)
      Reflect.set(value, key, toRaw(child));
    return;
  }
  if (lookupSetter.call(value, key) !== undefined)
    return;
  try {
    value[key] = toRaw(child);
  } catch {}
}
var MAX_CACHE_SIZE = 1000;
var pathCache = new WeakMap;
var pathCacheSize = new WeakMap;
var globalSeen = new WeakMap;
var wrapperCache = new WeakMap;
var locationNodes = new WeakMap;
var proxyStats = {
  created: 0,
  arrays: 0,
  maps: 0,
  sets: 0,
  objects: 0,
  staleEvicted: 0,
  detachedWrites: 0
};
function getProxyStats() {
  return { ...proxyStats, pathConcatCacheSize: 0 };
}
function resetProxyStats() {
  proxyStats.created = 0;
  proxyStats.arrays = 0;
  proxyStats.maps = 0;
  proxyStats.sets = 0;
  proxyStats.objects = 0;
  proxyStats.staleEvicted = 0;
  proxyStats.detachedWrites = 0;
}
function cleanupPathCache(root) {
  const cache = pathCache.get(root);
  if (cache && pathCacheSize.get(root) > MAX_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    let count = 0;
    for (const key of cache.keys()) {
      if (count >= entriesToRemove)
        break;
      cache.delete(key);
      count++;
    }
    pathCacheSize.set(root, MAX_CACHE_SIZE - entriesToRemove);
  }
}
function deepEqual(a, b, seen) {
  if (a === b)
    return true;
  if (a == null || b == null)
    return false;
  if (typeof a !== typeof b)
    return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (typeof a !== "object")
    return false;
  if (Array.isArray(a) !== Array.isArray(b))
    return false;
  if (seen !== undefined) {
    if (seen.has(a))
      return seen.get(a) === b;
    seen.set(a, b);
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++) {
      const left = a[i];
      if (left === undefined && !(i in a))
        continue;
      const right = b[i];
      if (left === right)
        continue;
      if (isObject(left) && isObject(right))
        seen ??= startSeen(a, b);
      if (!deepEqual(left, right, seen))
        return false;
    }
    return true;
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size)
      return false;
    for (const [key, left] of a) {
      if (!b.has(key))
        return false;
      const right = b.get(key);
      if (left === right)
        continue;
      if (isObject(left) && isObject(right))
        seen ??= startSeen(a, b);
      if (!deepEqual(left, right, seen))
        return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size)
      return false;
    for (const value of a) {
      if (!b.has(value))
        return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length)
    return false;
  for (let i = 0;i < keysA.length; i++) {
    const key = keysA[i];
    if (!hasOwn.call(b, key))
      return false;
    const left = a[key];
    const right = b[key];
    if (left === right)
      continue;
    if (isObject(left) && isObject(right))
      seen ??= startSeen(a, b);
    if (!deepEqual(left, right, seen))
      return false;
  }
  return true;
}
function startSeen(a, b) {
  const seen = new WeakMap;
  seen.set(a, b);
  return seen;
}
function setInPathCache(root, pathKey, value) {
  if (!pathCache.has(root)) {
    pathCache.set(root, new Map);
    pathCacheSize.set(root, 0);
  }
  const cache = pathCache.get(root);
  if (!cache.has(pathKey)) {
    pathCacheSize.set(root, pathCacheSize.get(root) + 1);
  } else {
    cache.delete(pathKey);
  }
  cache.set(pathKey, value);
  cleanupPathCache(root);
}
function evictDescendantsFromPathCache(root, pathKey) {
  const cache = pathCache.get(root);
  if (!cache)
    return;
  let evicted = 0;
  if (cache.has(pathKey)) {
    cache.delete(pathKey);
    evicted++;
  }
  const prefix = pathKey + ".";
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      evicted++;
    }
  }
  if (evicted > 0) {
    pathCacheSize.set(root, (pathCacheSize.get(root) ?? cache.size) - evicted);
  }
}
function isObject(val) {
  return val !== null && typeof val === "object";
}
var SNAPSHOT_SHARED_COPY_LIMIT = 1e5;

class SnapshotLimitError extends RangeError {
  constructor(extraCopies) {
    super(`reactive-proxy-state: a snapshot would copy shared objects more than ` + `${SNAPSHOT_SHARED_COPY_LIMIT} extra times (counted ${extraCopies} before stopping; ` + `an object is copied once per place it holds). Nothing was changed. To remove such a ` + `graph, see "Shared graphs have a copy limit" under "Synchronization Limits" in the README`);
    this.name = "SnapshotLimitError";
  }
}

class UnsupportedStateError extends TypeError {
  constructor(problem) {
    super(`reactive-proxy-state: ${problem}. Nothing was changed. See "Supported inputs" under ` + `"Synchronization Limits" in the README`);
    this.name = "UnsupportedStateError";
  }
}
var SNAPSHOT_CHECK_AFTER = SNAPSHOT_SHARED_COPY_LIMIT + 1;
function cloneTree(value, named) {
  return copyTree(value, undefined, undefined, false, named);
}
var REACHES = Symbol("reaches");
function cloneTreeUnless(value, container, named) {
  return copyUnless(value, container, false, named);
}
function cloneStored(value, container, named) {
  return copyUnless(value, container, true, named);
}
var copiedFresh = false;
function copyUnless(value, container, checkFresh, named) {
  try {
    return copyTree(value, container, undefined, checkFresh, named);
  } catch (error) {
    if (error === reachedContainer) {
      copiedFresh = false;
      return REACHES;
    }
    throw error;
  }
}
function cloneTreeAfter(value, container, contents, named) {
  return copyTree(value, container, contents, false, named);
}
var reachedContainer = new Error("reactive-proxy-state: internal, a copy reached its container");
function copyTree(value, container, contents, checkFresh, named) {
  if (value === null || typeof value !== "object") {
    if (checkFresh)
      copiedFresh = true;
    return value;
  }
  const top = toRaw(value);
  if (top === value && top !== container) {
    const small = copySmall(value, container, checkFresh, named);
    if (small !== undefined)
      return small;
  }
  const base = cloneAncestors.length;
  const workBase = cloneWork.length;
  const outerTop = cloneTop;
  const outerCountdown = cloneCountdown;
  const outerContainer = cloneContainer;
  const outerContents = cloneContents;
  const outerFresh = cloneFresh;
  const outerFirst = cloneFirst;
  const outerSeen = cloneSeen;
  const outerBase = cloneBase;
  const outerIndex = cloneIndex;
  const outerNamed = cloneNamed;
  cloneTop = top;
  cloneCountdown = SNAPSHOT_CHECK_AFTER;
  cloneContainer = container;
  cloneContents = contents;
  cloneFresh = checkFresh && locationNodes.get(top) === undefined;
  cloneFirst = undefined;
  cloneSeen = undefined;
  cloneBase = base;
  cloneIndex = undefined;
  cloneNamed = named;
  try {
    const copy = cloneEntry(value, 0, named);
    if (checkFresh)
      copiedFresh = cloneFresh;
    return copy;
  } finally {
    cloneAncestors.length = base;
    cloneCopies.length = base;
    cloneWork.length = workBase;
    cloneTop = outerTop;
    cloneCountdown = outerCountdown;
    cloneContainer = outerContainer;
    cloneContents = outerContents;
    cloneFresh = outerFresh;
    cloneFirst = outerFirst;
    cloneSeen = outerSeen;
    cloneBase = outerBase;
    cloneIndex = outerIndex;
    cloneNamed = outerNamed;
  }
}
var cloneTop;
var cloneCountdown = 0;
var cloneContainer;
var cloneContents;
var cloneFresh = false;
var cloneFirst;
var cloneSeen;
var cloneNamed = 0 /* None */;
function copySmall(value, container, checkFresh, named) {
  if (!Array.isArray(value)) {
    const copy2 = copyLeaf(value);
    if (copy2 !== undefined && checkFresh)
      copiedFresh = locationNodes.get(value) === undefined;
    return copy2;
  }
  const length = value.length;
  if (length > 8)
    return;
  if (named === 2 /* All */ && namedKeys(value) !== undefined)
    return;
  const copy = new Array(length);
  let fresh = checkFresh && locationNodes.get(value) === undefined;
  for (let i = 0;i < length; i++) {
    const item = value[i];
    if (item === null || typeof item !== "object") {
      if (item !== undefined || i in value)
        copy[i] = item;
      continue;
    }
    if (item === container || toRaw(item) !== item)
      return;
    const leaf = copyLeaf(item);
    if (leaf === undefined)
      return;
    copy[i] = leaf;
    if (fresh)
      fresh = locationNodes.get(item) === undefined && value.indexOf(item) === i;
  }
  if (checkFresh)
    copiedFresh = fresh;
  return copy;
}
function copyLeaf(value) {
  if (Object.getPrototypeOf(value) !== Object.prototype)
    return;
  const copy = {};
  for (const key in value) {
    if (!hasOwn.call(value, key))
      continue;
    const entry = value[key];
    if (entry !== null && typeof entry === "object")
      return;
    if (key === "__proto__")
      setData(copy, key, entry);
    else
      copy[key] = entry;
  }
  if (Object.getOwnPropertySymbols(value).length !== 0)
    return;
  return copy;
}
function readsOf(identity) {
  if (identity !== cloneContainer)
    return identity;
  if (cloneContents === undefined)
    throw reachedContainer;
  return cloneContents;
}
function countCopy() {
  if (--cloneCountdown === 0) {
    if (cloneFresh)
      cloneCountdown = SNAPSHOT_CHECK_AFTER;
    else
      checkSharedCopies(cloneTop);
  }
}
function noteFresh(value) {
  const identity = toRaw(value);
  if (identity !== value || identity === cloneTop || locationNodes.get(identity) !== undefined) {
    cloneFresh = false;
    return;
  }
  const first = cloneFirst;
  if (first === undefined) {
    cloneFirst = identity;
    return;
  }
  if (identity === first) {
    cloneFresh = false;
    return;
  }
  let seen = cloneSeen;
  if (seen === undefined) {
    seen = cloneSeen = new Set;
    seen.add(first);
  }
  const size = seen.size;
  seen.add(identity);
  if (seen.size === size)
    cloneFresh = false;
}
function namedKeys(array) {
  const keys = Object.keys(array);
  let start = keys.length;
  while (start > 0 && arrayIndex(keys[start - 1]) < 0)
    start--;
  const symbols = Object.getOwnPropertySymbols(array);
  let names = start === keys.length ? undefined : keys.slice(start);
  for (let i = 0;i < symbols.length; i++) {
    if (isEnumerable.call(array, symbols[i]))
      (names ??= []).push(symbols[i]);
  }
  return names;
}
function arrayIndex(key) {
  if (typeof key !== "string" || key.length === 0 || key.length > 10)
    return -1;
  const first = key.charCodeAt(0);
  if (first < 48 || first > 57 || first === 48 && key.length > 1)
    return -1;
  for (let i = 1;i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code < 48 || code > 57)
      return -1;
  }
  const index = Number(key);
  return index < 4294967295 ? index : -1;
}
function setData(object, key, value) {
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}
function checkSharedCopies(value) {
  const walk = { extra: 0, low: Infinity, marks: new Map };
  walkCopies(value, walk);
  if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT)
    throw new SnapshotLimitError(walk.extra);
}
function walkCopies(top, walk) {
  const frames = [];
  enterCopies(top, 0, walk, frames);
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.next < frame.entries.length && walk.extra <= SNAPSHOT_SHARED_COPY_LIMIT) {
      const entry = frame.entries[frame.next++];
      if (entry === null || typeof entry !== "object") {
        walk.low = Infinity;
        continue;
      }
      const size = enterCopies(entry, frame.depth + 1, walk, frames);
      if (frames[frames.length - 1] !== frame)
        continue;
      frame.size += size;
      if (walk.low < frame.low)
        frame.low = walk.low;
      continue;
    }
    frames.pop();
    walk.marks.set(frame.identity, frame.low > frame.depth ? frame.size : -1);
    walk.low = frame.low;
    const below = frames[frames.length - 1];
    if (below !== undefined) {
      below.size += frame.size;
      if (frame.low < below.low)
        below.low = frame.low;
    }
  }
}
function enterCopies(value, depth, walk, frames) {
  const identity = toRaw(value);
  const source = identity === cloneContainer ? readsOf(identity) : identity;
  const marks = walk.marks;
  const mark = marks.get(identity);
  if (mark !== undefined) {
    if (mark <= -2) {
      walk.low = -mark - 2;
      return 0;
    }
    walk.low = Infinity;
    if (mark > 0) {
      walk.extra += mark;
      return mark;
    }
    walk.extra++;
  }
  if (walk.extra > SNAPSHOT_SHARED_COPY_LIMIT) {
    if (mark === undefined)
      marks.set(identity, 1);
    walk.low = Infinity;
    return 1;
  }
  marks.set(identity, -(depth + 2));
  frames.push({ identity, depth, entries: entriesOf(source, identity), next: 0, size: 1, low: Infinity });
  return 0;
}
function entriesOf(source, identity) {
  if (Array.isArray(source)) {
    const names = keepsNamed(cloneNamed, identity === cloneTop ? 0 : 1) ? namedKeys(source) : undefined;
    if (names === undefined)
      return source;
    const entries2 = source.slice();
    for (let i = 0;i < names.length; i++)
      entries2.push(source[names[i]]);
    return entries2;
  }
  const entries = [];
  if (source instanceof Map) {
    for (const [key, entry] of Map.prototype.entries.call(source))
      entries.push(key, entry);
  } else if (source instanceof Set) {
    for (const entry of Set.prototype.values.call(source))
      entries.push(entry);
  }
  for (const key in source)
    if (hasOwn.call(source, key))
      entries.push(source[key]);
  const symbolKeys = Object.getOwnPropertySymbols(source);
  for (let i = 0;i < symbolKeys.length; i++) {
    if (isEnumerable.call(source, symbolKeys[i]))
      entries.push(source[symbolKeys[i]]);
  }
  return entries;
}
var cloneAncestors = [];
var cloneCopies = [];
var cloneBase = 0;
var cloneIndex;
var DEEP_PATH = 64;
var cloneWork = [];
var FILL_DEPTH = 256;
var hasOwn = Object.prototype.hasOwnProperty;
var isEnumerable = Object.prototype.propertyIsEnumerable;
function MethodCacheObject() {}
MethodCacheObject.prototype = Object.create(null);
function newMethodCache() {
  return new MethodCacheObject;
}
function collectionMember(target, prop, value) {
  if (typeof value !== "function" || prop === "valueOf")
    return value;
  return value.bind(target);
}
function enterPath(identity, copy, depth) {
  cloneAncestors.push(identity);
  cloneCopies.push(copy);
  if (depth < DEEP_PATH)
    return;
  if (cloneIndex !== undefined) {
    cloneIndex.set(identity, copy);
    return;
  }
  cloneIndex = new Map;
  for (let i = cloneBase;i < cloneAncestors.length; i++)
    cloneIndex.set(cloneAncestors[i], cloneCopies[i]);
}
function leavePath(length) {
  const ancestors = cloneAncestors;
  const index = cloneIndex;
  while (ancestors.length > length) {
    const identity = ancestors.pop();
    cloneCopies.pop();
    if (index !== undefined)
      index.delete(identity);
  }
  if (index !== undefined && length - cloneBase <= DEEP_PATH)
    cloneIndex = undefined;
}
function cloneValue(value, depth, named) {
  if (value === null || typeof value !== "object")
    return value;
  if (cloneFresh)
    noteFresh(value);
  return cloneEntry(value, depth, named);
}
function keepsNamed(named, depth) {
  return named === 2 /* All */ || named === 1 /* Below */ && depth > 0;
}
function cloneEntry(value, depth, named) {
  const identity = toRaw(value);
  if (identity === cloneContainer)
    value = readsOf(identity);
  if (depth > DEEP_PATH) {
    const ancestor = cloneIndex.get(identity);
    if (ancestor !== undefined)
      return ancestor;
  } else {
    const ancestors = cloneAncestors;
    for (let i = ancestors.length - 1, stop = ancestors.length - depth;i >= stop; i--) {
      if (ancestors[i] === identity)
        return cloneCopies[i];
    }
  }
  countCopy();
  let copy;
  let kind;
  if (Array.isArray(value)) {
    copy = new Array(value.length);
    kind = 1 /* Array */;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype) {
      copy = {};
      kind = 0 /* Object */;
    } else if (value instanceof Date) {
      copy = new Date(value.getTime());
      kind = 0 /* Object */;
    } else if (value instanceof Map) {
      copy = new Map;
      kind = 2 /* Map */;
    } else if (value instanceof Set) {
      copy = new Set;
      kind = 3 /* Set */;
    } else {
      copy = Object.create(prototype);
      kind = 0 /* Object */;
    }
  }
  if (depth >= FILL_DEPTH - 1) {
    cloneDeep(kind, value, identity, copy, depth, named);
    return copy;
  }
  const below = depth + 1;
  let pushed = false;
  if (kind === 0 /* Object */) {
    for (const key in value) {
      if (!hasOwn.call(value, key))
        continue;
      let child = value[key];
      if (child !== null && typeof child === "object") {
        if (!pushed) {
          pushed = true;
          enterPath(identity, copy, depth);
        }
        if (cloneFresh)
          noteFresh(child);
        child = cloneEntry(child, below, named);
      }
      if (key === "__proto__")
        setData(copy, key, child);
      else
        copy[key] = child;
    }
    const symbolKeys = Object.getOwnPropertySymbols(value);
    if (symbolKeys.length !== 0)
      pushed = fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed);
  } else if (kind === 1 /* Array */) {
    const length = copy.length;
    for (let i = 0;i < length; i++) {
      const child = value[i];
      if (child === null || typeof child !== "object") {
        if (child !== undefined || i in value)
          copy[i] = child;
        continue;
      }
      if (!pushed) {
        pushed = true;
        enterPath(identity, copy, depth);
      }
      if (cloneFresh)
        noteFresh(child);
      copy[i] = cloneEntry(child, below, named);
    }
    if (keepsNamed(named, depth))
      pushed = fillNamed(value, identity, copy, depth, named, pushed);
  } else {
    pushed = kind === 2 /* Map */ ? fillMap(value, identity, copy, depth, named) : fillSet(value, identity, copy, depth, named);
  }
  if (pushed) {
    if (depth < DEEP_PATH) {
      cloneAncestors.pop();
      cloneCopies.pop();
    } else {
      leavePath(cloneAncestors.length - 1);
    }
  }
  return copy;
}
function cloneDeep(kind, value, identity, copy, depth, named) {
  const pathLength = cloneAncestors.length;
  if (depth >= FILL_DEPTH) {
    cloneWork.push(kind, value, identity, copy, pathLength);
    return;
  }
  const workBase = cloneWork.length;
  fill(kind, value, identity, copy, depth, named);
  fillWaiting(workBase);
  leavePath(pathLength);
}
function fill(kind, value, identity, copy, depth, named) {
  if (kind === 0 /* Object */)
    fillObject(value, identity, copy, depth, named);
  else if (kind === 1 /* Array */)
    fillArray(value, identity, copy, depth, named);
  else if (kind === 2 /* Map */)
    fillMap(value, identity, copy, depth, named);
  else
    fillSet(value, identity, copy, depth, named);
}
function fillWaiting(workBase) {
  const work = cloneWork;
  while (work.length > workBase) {
    const at = work.length - 5;
    const kind = work[at];
    const value = work[at + 1];
    const identity = work[at + 2];
    const copy = work[at + 3];
    const pathLength = work[at + 4];
    work.length = at;
    if (cloneAncestors.length !== pathLength)
      leavePath(pathLength);
    fill(kind, value, identity, copy, FILL_DEPTH, cloneNamed);
  }
}
function fillObject(value, identity, copy, depth, named) {
  const below = depth + 1;
  let pushed = false;
  for (const key in value) {
    if (!hasOwn.call(value, key))
      continue;
    let child = value[key];
    if (child !== null && typeof child === "object") {
      if (!pushed) {
        pushed = true;
        enterPath(identity, copy, depth);
      }
      if (cloneFresh)
        noteFresh(child);
      child = cloneEntry(child, below, named);
    }
    if (key === "__proto__")
      setData(copy, key, child);
    else
      copy[key] = child;
  }
  const symbolKeys = Object.getOwnPropertySymbols(value);
  return symbolKeys.length === 0 ? pushed : fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed);
}
function fillSymbols(value, identity, copy, depth, named, symbolKeys, pushed) {
  const below = depth + 1;
  for (let i = 0;i < symbolKeys.length; i++) {
    const symbolKey = symbolKeys[i];
    if (!isEnumerable.call(value, symbolKey))
      continue;
    const child = value[symbolKey];
    if (child !== null && typeof child === "object" && !pushed) {
      pushed = true;
      enterPath(identity, copy, depth);
    }
    copy[symbolKey] = cloneValue(child, below, named);
  }
  return pushed;
}
function fillArray(value, identity, copy, depth, named) {
  const below = depth + 1;
  let pushed = false;
  const length = copy.length;
  for (let i = 0;i < length; i++) {
    const child = value[i];
    if (child === null || typeof child !== "object") {
      if (child !== undefined || i in value)
        copy[i] = child;
      continue;
    }
    if (!pushed) {
      pushed = true;
      enterPath(identity, copy, depth);
    }
    if (cloneFresh)
      noteFresh(child);
    copy[i] = cloneEntry(child, below, named);
  }
  return keepsNamed(named, depth) ? fillNamed(value, identity, copy, depth, named, pushed) : pushed;
}
function fillNamed(value, identity, copy, depth, named, pushed) {
  const names = namedKeys(value);
  if (names === undefined)
    return pushed;
  const below = depth + 1;
  for (let i = 0;i < names.length; i++) {
    const child = value[names[i]];
    if (child !== null && typeof child === "object" && !pushed) {
      pushed = true;
      enterPath(identity, copy, depth);
    }
    setData(copy, names[i], cloneValue(child, below, named));
  }
  return pushed;
}
function fillMap(value, identity, copy, depth, named) {
  const below = depth + 1;
  enterPath(identity, copy, depth);
  const entries = toRaw(value);
  Map.prototype.forEach.call(entries, (entry, key) => {
    const keyCopy = cloneValue(key, below, named);
    copy.set(nameMember(key, keyCopy, entries, false), cloneValue(entry, below, named));
  });
  fillCollectionProperties(entries, copy, below, named);
  return true;
}
function fillSet(value, identity, copy, depth, named) {
  const below = depth + 1;
  enterPath(identity, copy, depth);
  const members = toRaw(value);
  let later;
  Set.prototype.forEach.call(members, (entry) => {
    if (entry === null || typeof entry !== "object") {
      copy.add(entry);
      return;
    }
    const raw = toRaw(entry);
    if (raw !== entry && later === undefined && Set.prototype.has.call(members, raw))
      later = laterTwins(members);
    if (later !== undefined && later.has(entry))
      return;
    const entryCopy = cloneValue(entry, below, named);
    if (copyingPayload)
      nameCopyOfCopy(entry, entryCopy);
    else
      nameRaw(raw, collectionIdentities.members.get(raw), entry, entryCopy, members, false);
    copy.add(entryCopy);
  });
  fillCollectionProperties(members, copy, below, named);
  return true;
}
function laterTwins(set) {
  const seen = new Set;
  const later = new Set;
  Set.prototype.forEach.call(set, (member) => {
    if (member === null || typeof member !== "object")
      return;
    const raw = toRaw(member);
    if (seen.has(raw))
      later.add(member);
    else
      seen.add(raw);
  });
  return later;
}
function fillCollectionProperties(value, copy, depth, named) {
  for (const key in value) {
    if (hasOwn.call(value, key))
      setData(copy, key, cloneValue(value[key], depth, named));
  }
  const symbols = Object.getOwnPropertySymbols(value);
  for (let i = 0;i < symbols.length; i++) {
    if (isEnumerable.call(value, symbols[i]))
      setData(copy, symbols[i], cloneValue(value[symbols[i]], depth, named));
  }
}
var collectionIdentityKey = Symbol.for("@yiin/reactive-proxy-state.collection-identities.v4");
var collectionIdentities = Reflect.get(globalThis, collectionIdentityKey) ?? { members: new WeakMap, copies: new WeakMap, indexes: new WeakMap, overrides: new WeakMap, watches: new WeakMap };
if (!Reflect.has(globalThis, collectionIdentityKey)) {
  Object.defineProperty(globalThis, collectionIdentityKey, { value: collectionIdentities });
}
function ownToken(member) {
  const token = { shared: false };
  collectionIdentities.members.set(member, token);
  return token;
}
function nameMember(member, copy, collection, entering) {
  if (member === null || typeof member !== "object" || copy === null || typeof copy !== "object")
    return copy;
  if (copyingPayload) {
    nameCopyOfCopy(member, copy);
    return copy;
  }
  const raw = toRaw(member);
  const own = collectionIdentities.members.get(raw);
  if (own === undefined || own.shared)
    return nameRaw(raw, own, member, copy, collection, entering);
  if (copy !== member)
    collectionIdentities.copies.set(copy, own);
  return copy;
}
function nameKey(event, key, collection, entering) {
  const raw = toRaw(key);
  const own = collectionIdentities.members.get(raw);
  if (own === undefined) {
    if (entering)
      ownToken(raw);
    else
      namedInPlace(raw, collection);
    return;
  }
  if (!own.shared)
    return;
  event.key = nameRaw(raw, own, key, key, collection, entering);
}
function nameRaw(raw, own, member, copy, collection, entering) {
  let token;
  if (own === undefined)
    token = entering ? ownToken(raw) : namedInPlace(raw, collection);
  else if (!own.shared)
    token = own;
  else
    token = sharedTokenIn(raw, own, collection, entering);
  if (copy !== member) {
    collectionIdentities.copies.set(copy, token);
    return copy;
  }
  return own === undefined || token === own ? copy : carrier(raw, token);
}
function namedInPlace(member, collection) {
  const origin = collectionIdentities.copies.get(member);
  if (origin === undefined)
    return ownToken(member);
  const index = replicaIndex(collection, true);
  const held = heldMember(collection, index, origin);
  if (held !== undefined && held !== member) {
    const token = ownToken(member);
    index.byToken.set(token, member);
    return token;
  }
  origin.shared = true;
  collectionIdentities.members.set(member, origin);
  index.byToken.set(origin, member);
  return origin;
}
function sharedTokenIn(member, token, collection, entering) {
  let inCollection = collectionIdentities.overrides.get(collection);
  const current = inCollection?.get(member) ?? token;
  if (!entering)
    return current;
  const index = replicaIndex(collection, true);
  const held = heldMember(collection, index, current);
  if (held === undefined || held === member)
    return current;
  const other = { shared: false };
  if (inCollection === undefined)
    collectionIdentities.overrides.set(collection, inCollection = new WeakMap);
  inCollection.set(member, other);
  index.byToken.set(other, member);
  return other;
}
function carrier(member, token) {
  const copy = cloneTree(member, 2 /* All */);
  collectionIdentities.copies.set(copy, token);
  return copy;
}
function nameCopyOfCopy(source, copy) {
  if (source === null || typeof source !== "object" || copy === null || typeof copy !== "object")
    return;
  const token = collectionIdentities.copies.get(source) ?? collectionIdentities.members.get(source);
  if (token !== undefined)
    collectionIdentities.copies.set(copy, token);
}
var copyingPayload = false;
function copyingPayloads(run) {
  const outer = copyingPayload;
  copyingPayload = true;
  try {
    return run();
  } finally {
    copyingPayload = outer;
  }
}
function eventToken(member) {
  const raw = toRaw(member);
  return collectionIdentities.members.get(raw) ?? collectionIdentities.copies.get(raw);
}
function replicaIndex(collection, member) {
  let index = collectionIdentities.indexes.get(collection);
  const size = collection.size;
  if (index === undefined || index.size !== size || index.member !== member) {
    const byToken = new Map;
    const overrides = member ? collectionIdentities.overrides.get(collection) : undefined;
    const members = collection instanceof Map ? Map.prototype.keys.call(collection) : Set.prototype.values.call(collection);
    for (const held of members) {
      if (held === null || typeof held !== "object")
        continue;
      const raw = toRaw(held);
      if (member) {
        const own = overrides?.get(raw) ?? collectionIdentities.members.get(raw);
        if (own !== undefined) {
          byToken.set(own, held);
          continue;
        }
        const origin = collectionIdentities.copies.get(raw);
        if (origin !== undefined && !byToken.has(origin))
          byToken.set(origin, held);
      } else {
        const token = collectionIdentities.copies.get(raw) ?? collectionIdentities.members.get(raw);
        if (token !== undefined && !byToken.has(token))
          byToken.set(token, held);
      }
    }
    index = { byToken, size, member };
    collectionIdentities.indexes.set(collection, index);
    const watch = indexWatches.get(collection);
    if (watch !== undefined)
      watch.indexed = true;
  }
  return index;
}
var indexWatches = collectionIdentities.watches;
function watchIndex(collection) {
  const watch = { indexed: collectionIdentities.indexes.has(collection) };
  indexWatches.set(collection, watch);
  return watch;
}
function heldToken(collection, member) {
  return collectionIdentities.overrides.get(collection)?.get(member) ?? collectionIdentities.members.get(member);
}
function indexAdded(collection, member) {
  const index = collectionIdentities.indexes.get(collection);
  if (index === undefined)
    return;
  if (!index.member || index.size !== collection.size - 1) {
    collectionIdentities.indexes.delete(collection);
    return;
  }
  index.size = collection.size;
  if (member === null || typeof member !== "object")
    return;
  const raw = toRaw(member);
  const own = heldToken(collection, raw);
  if (own !== undefined) {
    index.byToken.set(own, member);
    return;
  }
  const origin = collectionIdentities.copies.get(raw);
  if (origin !== undefined && !index.byToken.has(origin))
    index.byToken.set(origin, member);
}
function indexRemoved(collection, member) {
  const index = collectionIdentities.indexes.get(collection);
  if (index === undefined)
    return;
  if (!index.member || index.size !== collection.size + 1) {
    collectionIdentities.indexes.delete(collection);
    return;
  }
  index.size = collection.size;
  if (member === null || typeof member !== "object")
    return;
  const raw = toRaw(member);
  const token = heldToken(collection, raw) ?? collectionIdentities.copies.get(raw);
  if (token !== undefined && index.byToken.get(token) === member)
    index.byToken.delete(token);
}
function keepIndexSize(collection) {
  const index = collectionIdentities.indexes.get(collection);
  if (index !== undefined)
    index.size = collection.size;
}
function heldMember(raw, index, token) {
  const held = index.byToken.get(token);
  return held !== undefined && raw.has(held) ? held : undefined;
}
function newMember(raw, member, token, reactive) {
  let added = member;
  if (raw.has(member)) {
    added = cloneTree(member, 2 /* All */);
    collectionIdentities.copies.set(added, token);
  }
  if (reactive && !collectionIdentities.members.has(added)) {
    token.shared = true;
    collectionIdentities.members.set(added, token);
  }
  return added;
}
function objectToken(value) {
  return value !== null && typeof value === "object" ? eventToken(value) : undefined;
}
function replicaAdd(set, value) {
  const raw = toRaw(set);
  const token = objectToken(value);
  if (token === undefined) {
    set.add(value);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== set);
  if (heldMember(raw, index, token) !== undefined)
    return;
  const member = newMember(raw, toRaw(value), token, set !== raw);
  set.add(member);
  index.byToken.set(token, member);
  index.size = raw.size;
}
function replicaDelete(set, value) {
  const raw = toRaw(set);
  const token = objectToken(value);
  if (token === undefined) {
    set.delete(value);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== set);
  const held = heldMember(raw, index, token);
  set.delete(held === undefined ? value : held);
  index.byToken.delete(token);
  index.size = raw.size;
}
function replicaMapSet(map, key, value) {
  const raw = toRaw(map);
  const token = objectToken(key);
  if (token === undefined) {
    map.set(key, value);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== map);
  const held = heldMember(raw, index, token);
  if (held !== undefined) {
    map.set(held, value);
    return;
  }
  const member = newMember(raw, toRaw(key), token, map !== raw);
  map.set(member, value);
  index.byToken.set(token, member);
  index.size = raw.size;
}
function replicaMapDelete(map, key) {
  const raw = toRaw(map);
  const token = objectToken(key);
  if (token === undefined) {
    map.delete(key);
    keepIndexSize(raw);
    return;
  }
  const index = replicaIndex(raw, raw !== map);
  const held = heldMember(raw, index, token);
  map.delete(held === undefined ? key : held);
  index.byToken.delete(token);
  index.size = raw.size;
}
function forgetReplicaIndex(collection) {
  collectionIdentities.indexes.delete(toRaw(collection));
}
function deepClone(value, seen = new WeakMap) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const identity = toRaw(value);
  if (seen.has(identity)) {
    return seen.get(identity);
  }
  if (Array.isArray(value)) {
    const newArray = [];
    seen.set(identity, newArray);
    for (let i = 0;i < value.length; i++) {
      newArray[i] = deepClone(value[i], seen);
    }
    return newArray;
  }
  if (value instanceof Map) {
    const newMap = new Map;
    seen.set(identity, newMap);
    value.forEach((val, key) => {
      newMap.set(deepClone(key, seen), deepClone(val, seen));
    });
    return newMap;
  }
  if (value instanceof Set) {
    const newSet = new Set;
    seen.set(identity, newSet);
    value.forEach((val) => {
      newSet.add(deepClone(val, seen));
    });
    return newSet;
  }
  const newObject = Object.create(Object.getPrototypeOf(value));
  seen.set(identity, newObject);
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      newObject[key] = deepClone(value[key], seen);
    }
  }
  const symbolKeys = Object.getOwnPropertySymbols(value);
  for (const symbolKey of symbolKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, symbolKey);
    if (descriptor && Object.prototype.propertyIsEnumerable.call(value, symbolKey)) {
      newObject[symbolKey] = deepClone(value[symbolKey], seen);
    }
  }
  return newObject;
}
// src/watch-effect.ts
var activeEffect = null;
var trackingVersion = 0;
function setActiveEffect(effect) {
  activeEffect = effect;
  trackingVersion++;
}

class Dep extends Set {
  owner;
  key;
  membershipOnly;
  constructor(owner, key) {
    super();
    this.owner = owner;
    this.key = key;
  }
}
var ownerRefs = new WeakMap;
var targetMap = new WeakMap;
var entryMap = new WeakMap;
var emptiedDeps = [];
var emptiedCount = 0;
function releaseDep(dep) {
  if (dep.size !== 0)
    return;
  const owner = dep.owner instanceof WeakRef ? dep.owner.deref() : dep.owner;
  if (owner?.get(dep.key) === dep)
    owner.delete(dep.key);
}
function releaseEmptied(from) {
  for (let i = from;i < emptiedCount; i++) {
    releaseDep(emptiedDeps[i]);
    emptiedDeps[i] = undefined;
  }
  emptiedCount = from;
  if (from === 0 && emptiedDeps.length > 4096)
    emptiedDeps.length = 0;
}
function depsOf(maps, target) {
  const deps = maps.get(target);
  if (deps === undefined || deps.size > 0)
    return deps;
  maps.delete(target);
  return;
}
function dependencyCounts(target) {
  return { properties: targetMap.get(target)?.size, entries: entryMap.get(target)?.size };
}
function detachEffect(effect, defer) {
  const dependencies = effect.dependencies;
  if (dependencies === undefined || dependencies.size === 0)
    return;
  dependencies.forEach((dep) => {
    dep.delete(effect);
    if (dep.size > 0)
      return;
    if (defer)
      emptiedDeps[emptiedCount++] = dep;
    else
      releaseDep(dep);
  });
  dependencies.clear();
}
function cleanupEffect(effect) {
  trackingVersion++;
  detachEffect(effect, false);
}
function runCleanupFunctions(effect) {
  if (effect.cleanupFns && effect.cleanupFns.length > 0) {
    effect.cleanupFns.forEach((cleanupFn) => {
      try {
        cleanupFn();
      } catch (error) {
        console.error("Error in effect cleanup function:", error);
      }
    });
    effect.cleanupFns = [];
  }
}
function depFor(maps, target, key) {
  let deps = maps.get(target);
  if (deps === undefined) {
    deps = new Map;
    maps.set(target, deps);
  }
  let dep = deps.get(key);
  if (dep === undefined) {
    let owner = deps;
    if (deps.size > 0) {
      let ref = ownerRefs.get(deps);
      if (ref === undefined) {
        ref = new WeakRef(deps);
        ownerRefs.set(deps, ref);
      }
      if (deps.size === 1)
        deps.forEach((existing) => {
          existing.owner = ref;
        });
      owner = ref;
    }
    dep = new Dep(owner, key);
    deps.set(key, dep);
  }
  return dep;
}
function addDep(dep, target, key) {
  const effect = activeEffect;
  if (dep.has(effect))
    return;
  dep.add(effect);
  if (!effect.dependencies) {
    effect.dependencies = new Set;
  }
  effect.dependencies.add(dep);
  if (effect.options?.onTrack) {
    effect.options.onTrack({ effect: effect._rawCallback, target, key, type: "track" });
  }
}
function track(target, key) {
  if (!activeEffect || !activeEffect.active)
    return;
  addDep(depFor(targetMap, target, key), target, key);
}
function trackEntry(target, entry) {
  if (!activeEffect || !activeEffect.active)
    return;
  const dep = depFor(entryMap, target, entry);
  dep.membershipOnly?.delete(activeEffect);
  addDep(dep, target, entry);
}
function trackMembership(target, entry) {
  if (!activeEffect || !activeEffect.active)
    return;
  trackMembershipDep(depFor(entryMap, target, entry), target, entry);
}
function trackMembershipDep(dep, target, key) {
  if (!dep.has(activeEffect)) {
    dep.membershipOnly ??= new WeakSet;
    dep.membershipOnly.add(activeEffect);
  }
  addDep(dep, target, key);
}
function trackMapKeys(target) {
  if (!activeEffect || !activeEffect.active)
    return;
  trackMembershipDep(depFor(targetMap, target, Symbol.iterator), target, Symbol.iterator);
}
function trackMapValues(target) {
  if (!activeEffect || !activeEffect.active)
    return;
  const dep = depFor(targetMap, target, Symbol.iterator);
  dep.membershipOnly?.delete(activeEffect);
  addDep(dep, target, Symbol.iterator);
}
var keysKey = Symbol("keys");
function trackKeys(target) {
  track(target, keysKey);
}
var queue = [];
var triggerNotifications = [];
var flushing = false;
var batchDepth = 0;
var flushCount = 0;
var MAX_FLUSH_RUNS = 1e5;
function flushEffects() {
  flushing = true;
  const flushId = ++flushCount;
  let failed = false;
  let failure;
  let index = 0;
  let notifications = 0;
  try {
    for (;index < queue.length || triggerNotifications.length > 0; index++) {
      if (triggerNotifications.length > 0) {
        for (let next = 0;next < triggerNotifications.length; next++) {
          try {
            if (++notifications > MAX_FLUSH_RUNS) {
              throw new RangeError("reactive-proxy-state: trigger hooks keep writing new values in one flush");
            }
            triggerNotifications[next]();
          } catch (error) {
            if (!failed) {
              failed = true;
              failure = error;
            }
          }
          if (notifications > MAX_FLUSH_RUNS)
            break;
        }
        triggerNotifications.length = 0;
      }
      if (index >= queue.length)
        break;
      const effect = queue[index];
      effect.queued = false;
      if (!effect.active)
        continue;
      const runs = effect.flushId === flushId ? effect.flushRuns + 1 : 1;
      effect.flushId = flushId;
      effect.flushRuns = runs;
      if (runs > MAX_FLUSH_RUNS) {
        if (!failed) {
          failed = true;
          failure = new RangeError(`reactive-proxy-state: an effect ran ${MAX_FLUSH_RUNS} times in one flush. ` + `Effects that write what other effects read loop when each write is new`);
        }
        index++;
        break;
      }
      try {
        const scheduler = effect.options?.scheduler;
        if (scheduler)
          scheduler(effect.run);
        else
          effect.run();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  } finally {
    for (;index < queue.length; index++)
      queue[index].queued = false;
    queue.length = 0;
    if (triggerNotifications.length > 0)
      triggerNotifications.length = 0;
    flushing = false;
    if (batchDepth === 0)
      endOperation();
  }
  if (failed)
    throw failure;
}
function startBatch() {
  batchDepth++;
}
function endBatch() {
  if (--batchDepth !== 0 || flushing)
    return;
  if (queue.length > 0 || triggerNotifications.length > 0)
    flushEffects();
  else
    endOperation();
}
function beginWrite() {
  startBatch();
}
function endWrite() {
  endBatch();
}
function queueEffects(dep, target, key, valuesOnly = false) {
  if (dep === undefined)
    return;
  dep.forEach((effect) => {
    if (valuesOnly && dep.membershipOnly?.has(effect))
      return;
    if (effect === (activeEffect ?? emittingEffect) || !effect.active)
      return;
    const onTrigger = effect.options?.onTrigger;
    if (onTrigger) {
      triggerNotifications.push(() => {
        if (effect.active)
          onTrigger({ effect: effect._rawCallback, target, key, type: "trigger" });
      });
    }
    if (effect.invalidate !== undefined) {
      effect.invalidate();
    } else if (!effect.queued) {
      effect.queued = true;
      queue.push(effect);
    }
  });
}
function trigger(target, key) {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap)
    return;
  startBatch();
  try {
    queueEffects(depsMap.get(key), target, key);
  } finally {
    endBatch();
  }
}
function writeThroughSetter(target, prop, value, receiver, forwards, oldValue) {
  startBatch();
  try {
    const result = Reflect.set(target, prop, value, receiver);
    if (result && (forwards || target[prop] !== oldValue))
      trigger(target, prop);
    return result;
  } finally {
    endBatch();
  }
}
function triggerKeyChange(target) {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap)
    return;
  startBatch();
  try {
    depsMap.forEach((dep, key) => queueEffects(dep, target, key));
  } finally {
    endBatch();
  }
}
function queueIndexes(depsMap, target, from, to, same) {
  if (to - from <= depsMap.size) {
    for (let index = from;index < to; index++) {
      const key = String(index);
      const dep = depsMap.get(key);
      if (dep === undefined || same !== undefined && same(index))
        continue;
      queueEffects(dep, target, key);
    }
  } else {
    depsMap.forEach((dep, key) => {
      const index = arrayIndex(key);
      if (index < from || index >= to)
        return;
      if (same !== undefined && same(index))
        return;
      queueEffects(dep, target, key);
    });
  }
}
function queueWhole(depsMap, target, lengthChanged) {
  if (lengthChanged)
    queueEffects(depsMap.get("length"), target, "length");
  queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator);
}
function triggerArray(target, from, to, lengthChanged, before) {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap)
    return;
  startBatch();
  try {
    queueIndexes(depsMap, target, from, to, before === undefined ? undefined : (index) => sameAt(before, target, index));
    queueWhole(depsMap, target, lengthChanged);
  } finally {
    endBatch();
  }
}
function triggerSplice(target, start, removed, inserted, oldLength) {
  const depsMap = depsOf(targetMap, target);
  if (!depsMap)
    return;
  const newLength = target.length;
  const removedEnd = start + removed.length;
  const moved = removed.length - inserted;
  const end = moved === 0 ? removedEnd : Math.max(oldLength, newLength);
  const same = (index) => {
    let had;
    let held;
    if (index < removedEnd) {
      had = index - start in removed;
      held = removed[index - start];
    } else if (index < oldLength) {
      const now = index - moved;
      had = now in target;
      held = target[now];
    } else {
      had = false;
      held = undefined;
    }
    return Object.is(held, target[index]) && had === index in target;
  };
  if (moved === 0 && unchanged(start, end, same))
    return;
  startBatch();
  try {
    queueIndexes(depsMap, target, start, end, same);
    queueWhole(depsMap, target, oldLength !== newLength);
  } finally {
    endBatch();
  }
}
function unchanged(from, to, same) {
  for (let index = from;index < to; index++) {
    if (!same(index))
      return false;
  }
  return true;
}
function triggerCollection(target, entry, sizeChanged) {
  const depsMap = depsOf(targetMap, target);
  const entryDeps = depsOf(entryMap, target);
  if (!depsMap && !entryDeps)
    return;
  startBatch();
  try {
    if (entryDeps)
      queueEffects(entryDeps.get(entry), target, entry, !sizeChanged);
    if (depsMap) {
      if (sizeChanged)
        queueEffects(depsMap.get("size"), target, "size");
      queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator, !sizeChanged);
    }
  } finally {
    endBatch();
  }
}
function triggerCleared(target, removed) {
  const depsMap = depsOf(targetMap, target);
  const entryDeps = depsOf(entryMap, target);
  if (!depsMap && !entryDeps)
    return;
  startBatch();
  try {
    if (entryDeps) {
      for (let i = 0;i < removed.length; i++)
        queueEffects(entryDeps.get(removed[i]), target, removed[i]);
    }
    if (depsMap) {
      queueEffects(depsMap.get("size"), target, "size");
      queueEffects(depsMap.get(Symbol.iterator), target, Symbol.iterator);
    }
  } finally {
    endBatch();
  }
}
function sameAt(before, after, index) {
  return Object.is(before[index], after[index]) && index in before === index in after;
}
function watchEffect(effectCallback, options = {}) {
  const run = () => {
    if (!effectFn.active) {
      throw new Error("Trying to run a stopped effect");
    }
    const previousEffect = activeEffect;
    const emptiedFrom = emptiedCount;
    try {
      runCleanupFunctions(effectFn);
      detachEffect(effectFn, true);
      setActiveEffect(effectFn);
      const onCleanup = (cleanupFn) => {
        if (!effectFn.cleanupFns) {
          effectFn.cleanupFns = [];
        }
        effectFn.cleanupFns.push(cleanupFn);
      };
      return effectCallback(onCleanup);
    } finally {
      setActiveEffect(previousEffect);
      releaseEmptied(emptiedFrom);
    }
  };
  const effectFn = {
    run,
    dependencies: new Set,
    options,
    active: true,
    _rawCallback: effectCallback,
    cleanupFns: [],
    invalidate: undefined,
    queued: false,
    flushId: 0,
    flushRuns: 0
  };
  if (!options.lazy) {
    effectFn.run();
  }
  const stopHandle = () => {
    if (effectFn.active) {
      runCleanupFunctions(effectFn);
      cleanupEffect(effectFn);
      effectFn.active = false;
    }
  };
  stopHandle.effect = effectFn;
  return stopHandle;
}

// src/listener.ts
var MAX_LISTENER_WRITE_DEPTH = 100;
var MAX_LISTENER_WRITE_ROUNDS = 1e5;
var listening = -1;
var emittingEffect = null;
var asyncDeliveries = 0;
var rounds = 0;
var refusal;
function writeGeneration() {
  return (listening >> 1) + 1;
}
function listenerGeneration() {
  return listening >> 1;
}
function checkListenerWrite() {
  if (listening < 0)
    return;
  if (refusal !== undefined)
    throw refusal;
  if ((listening & 1) !== 0)
    return;
  const generation = listening >> 1;
  if (generation < MAX_LISTENER_WRITE_DEPTH && (generation === 0 || ++rounds <= MAX_LISTENER_WRITE_ROUNDS)) {
    listening |= 1;
    return;
  }
  refusal ??= new RangeError(generation >= MAX_LISTENER_WRITE_DEPTH ? `reactive-proxy-state: refused a listener write nested ${generation + 1} deep ` + `(at most ${MAX_LISTENER_WRITE_DEPTH}). Filter event paths to stop listener writes from repeating` : `reactive-proxy-state: refused a listener write after ${MAX_LISTENER_WRITE_ROUNDS} nested rounds ` + `in one operation. Filter event paths to stop listener writes from repeating`);
  throw refusal;
}
function endOperation() {
  if (rounds === 0 && refusal === undefined || listening >= 0 || asyncDeliveries > 0)
    return;
  rounds = 0;
  const error = refusal;
  if (error === undefined)
    return;
  refusal = undefined;
  throw error;
}
function beginAsyncDelivery() {
  asyncDeliveries++;
}
function isRefusal(error) {
  return error === refusal && error !== undefined;
}
function endAsyncDelivery() {
  asyncDeliveries--;
  rounds = 0;
  const error = refusal;
  if (error === undefined)
    return;
  refusal = undefined;
  console.error(error);
}
function emitListener(emit, event, generation) {
  if (activeEffect !== null) {
    emitUntracked(emit, event, generation);
    return;
  }
  const previous = listening;
  listening = generation << 1;
  try {
    emit(event);
  } finally {
    listening = previous;
    if (previous < 0 && batchDepth === 0 && !flushing)
      endOperation();
  }
}
function emitUntracked(emit, event, generation) {
  const previous = listening;
  const previousEffect = activeEffect;
  const previousEmittingEffect = emittingEffect;
  emittingEffect = previousEffect;
  setActiveEffect(null);
  listening = generation << 1;
  try {
    emit(event);
  } finally {
    setActiveEffect(previousEffect);
    emittingEffect = previousEmittingEffect;
    listening = previous;
    if (previous < 0 && batchDepth === 0 && !flushing)
      endOperation();
  }
}

// src/location.ts
class Place {
  parentRef;
  parentId;
  key;
  constructor(parent, key) {
    this.parentRef = new WeakRef(parent);
    this.parentId = parent.id;
    this.key = key;
    parent.childPlaces++;
  }
  get parent() {
    return this.parentRef.deref();
  }
}
function dropped(place) {
  const parent = place.parent;
  if (parent !== undefined)
    parent.childPlaces--;
}
var WIDE = 8;
var nodes = locationNodes;
var nodeCount = 0;
var FAST_CHAIN_LIMIT = 256;
function isObject2(value) {
  return value !== null && typeof value === "object";
}
function getLocationNode(raw) {
  return nodes.get(raw);
}
function ensureLocationNode(raw) {
  let node = nodes.get(raw);
  if (node === undefined) {
    node = {
      id: ++nodeCount,
      raw,
      kind: raw instanceof Map ? 1 /* Map */ : raw instanceof Set ? 2 /* Set */ : 0 /* Plain */,
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
      index: undefined
    };
    nodes.set(raw, node);
  }
  return node;
}
function setterOf(target, prop, own, node) {
  if (own) {
    let dataOnly = node.dataOnly;
    if (dataOnly === undefined)
      dataOnly = node.dataOnly = hasNoOwnAccessor(target);
    if (dataOnly)
      return;
    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
    return descriptor !== undefined && descriptor.set !== undefined ? descriptor : undefined;
  }
  if (!(prop in target))
    return;
  for (let proto = Object.getPrototypeOf(target);proto !== null; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(proto, prop);
    if (descriptor !== undefined)
      return descriptor.set !== undefined ? descriptor : undefined;
  }
  return;
}
function forwardsTo(receiver, target) {
  if (receiver === target || receiver === null || typeof receiver !== "object" || receiver["__v_raw" /* RAW */] !== target)
    return false;
  let proto = Object.getPrototypeOf(receiver);
  for (let hops = 0;proto !== null; hops++) {
    if (hops === MAX_RECEIVER_CHAIN || proto["__v_raw" /* RAW */] === target)
      return false;
    proto = Object.getPrototypeOf(proto);
  }
  return true;
}
var MAX_RECEIVER_CHAIN = 64;
function hasNoOwnAccessor(target) {
  const keys = Reflect.ownKeys(target);
  if (keys.length > 64)
    return false;
  for (let i = 0;i < keys.length; i++) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, keys[i]);
    if (descriptor.get !== undefined || descriptor.set !== undefined)
      return false;
  }
  return true;
}
function holdsIn(parent, key, raw) {
  if (parent === undefined)
    return false;
  const container = parent.raw;
  switch (parent.kind) {
    case 1 /* Map */: {
      const held = container.get(key);
      return held === raw || proxyOf(held, raw);
    }
    case 2 /* Set */:
      return container.has(raw);
    default: {
      const held = container[key];
      return held === raw || proxyOf(held, raw);
    }
  }
}
function proxyOf(held, raw) {
  return isObject2(held) && held["__v_raw" /* RAW */] !== undefined && toRaw(held) === raw;
}
function holds(place, raw) {
  return holdsIn(place.parent, place.key, raw);
}
function segment(parent, key, raw) {
  if (parent.kind === 2 /* Set */) {
    let index = 0;
    for (const member of parent.raw) {
      if (member === raw)
        break;
      index++;
    }
    return String(index);
  }
  return String(key);
}
function samePlace(place, parent, key) {
  return place.parentId === parent.id && (parent.kind === 2 /* Set */ || place.key === key);
}
function chain(node, tail) {
  let reversed;
  let current = node;
  for (let steps = 0;steps < FAST_CHAIN_LIMIT; steps++) {
    const places = current.places;
    const root = current.root;
    if (root !== undefined) {
      if (places.length !== 0)
        return;
      return { root, paths: [buildPath(root.path, reversed, tail)] };
    }
    if (places.length !== 1)
      return places.length === 0 ? null : undefined;
    const place = places[0];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, current.raw)) {
      dropped(place);
      current.places = [];
      return null;
    }
    (reversed ??= []).push(segment(parent, place.key, current.raw));
    current = parent;
  }
  return;
}
function findAll(node, tail, firstOnly) {
  const out = [];
  const segments = [];
  const visiting = new Set;
  const frames = [];
  const enter = (entered) => {
    visiting.add(entered);
    const root = entered.root;
    if (root !== undefined)
      out.push({ root, path: buildPath(root.path, segments, tail) });
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
      if (visiting.has(parent))
        continue;
      segments.push(segment(parent, place.key, current.raw));
      const root = parent.root;
      if (root !== undefined && parent.places.length === 0) {
        out.push({ root, path: buildPath(root.path, segments, tail) });
        segments.pop();
      } else {
        enter(parent);
      }
      continue;
    }
    frames.pop();
    if (frame.stale)
      current.places = keepPlaces(frame.places, (place) => holds(place, current.raw));
    visiting.delete(current);
    if (frames.length > 0)
      segments.pop();
  }
  return out;
}
function buildPath(base, reversed, tail) {
  const middle = reversed === undefined ? 0 : reversed.length;
  const path = new Array(base.length + middle + (tail === undefined ? 0 : 1));
  let index = 0;
  for (let i = 0;i < base.length; i++)
    path[index++] = base[i];
  for (let i = middle - 1;i >= 0; i--)
    path[index++] = reversed[i];
  if (tail !== undefined)
    path[index] = String(tail);
  return path;
}
function locate(node, tail) {
  checkListenerWrite();
  const single = chain(node, tail);
  if (single !== undefined) {
    if (single === null) {
      proxyStats.detachedWrites++;
      return;
    }
    return single.root.emit === undefined ? undefined : single;
  }
  const found = findAll(node, tail, false);
  if (found.length === 0) {
    proxyStats.detachedWrites++;
    return;
  }
  let root = found[0].root;
  for (let i = 1;i < found.length; i++) {
    if (found[i].root !== root) {
      if (node.scope !== undefined && found.some((entry) => entry.root === node.scope)) {
        root = node.scope;
      }
      break;
    }
  }
  if (root.emit === undefined)
    return;
  const paths = [];
  for (let i = 0;i < found.length; i++) {
    if (found[i].root === root)
      paths.push(found[i].path);
  }
  return { root, paths };
}
function isAttached(node) {
  const single = chain(node, undefined);
  if (single !== undefined)
    return single !== null;
  return findAll(node, undefined, true).length > 0;
}
function attachedBefore(node, former) {
  let current = node;
  for (let steps = 0;steps < FAST_CHAIN_LIMIT; steps++) {
    if (current.root !== undefined || current === former)
      return true;
    const places = current.places;
    if (places.length !== 1)
      break;
    const place = places[0];
    const parent = place.parent;
    if (!holdsIn(parent, place.key, current.raw))
      return false;
    current = parent;
  }
  if (current.root !== undefined || current === former)
    return true;
  const visited = new Set;
  visited.add(current);
  const stack = [current];
  const next = [0];
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
    if (!holdsIn(parent, place.key, at.raw))
      continue;
    if (parent.root !== undefined || parent === former)
      return true;
    if (visited.has(parent))
      continue;
    visited.add(parent);
    stack.push(parent);
    next.push(0);
  }
  return false;
}
function dispatch(target, event) {
  const { root, paths } = target;
  if (paths.length === 1) {
    if (root.undelivered === undefined)
      emitListener(root.emit, event, writeGeneration());
    else
      deliver(root, [event]);
    return;
  }
  deliver(root, copyingPayloads(() => copiesPerPath(event, paths, copiesRemoved(target))));
}
function copiesPerPath(event, paths, async) {
  const removesValue = event.action === "set-delete";
  const events = [event];
  for (let i = 1;i < paths.length; i++) {
    const copy = { ...event, path: paths[i] };
    if (isObject2(event.newValue))
      copy.newValue = cloneTree(event.newValue, event.action === "replace" ? 1 /* Below */ : 0 /* None */);
    if (isObject2(event.value) && !removesValue) {
      copy.value = cloneTree(event.value, 2 /* All */);
      nameCopyOfCopy(event.value, copy.value);
    }
    if (event.items !== undefined)
      copy.items = cloneTree(event.items, 1 /* Below */);
    if (async) {
      if (isObject2(event.oldValue))
        copy.oldValue = cloneTree(event.oldValue, 2 /* All */);
      if (event.oldValues !== undefined)
        copy.oldValues = cloneTree(event.oldValues, 1 /* Below */);
      if (removesValue) {
        copy.value = copy.oldValue;
        nameCopyOfCopy(event.value, copy.value);
      }
    }
    events.push(copy);
  }
  return events;
}
function deliver(root, events) {
  const emit = root.emit;
  const generation = writeGeneration();
  const waiting = root.undelivered;
  if (waiting !== undefined) {
    if (waiting.changeAt < 0) {
      if (generation !== waiting.generation) {
        waiting.changeAt = waiting.events.length;
        waiting.changeGeneration = generation;
      }
    } else {
      const marks = waiting.marks;
      if (generation !== (marks === undefined ? waiting.changeGeneration : marks[marks.length - 1])) {
        (waiting.marks ??= []).push(waiting.events.length, generation);
      }
    }
    for (let i = 0;i < events.length; i++) {
      waiting.events.push(events[i]);
    }
    return;
  }
  if (events.length === 1) {
    emitListener(emit, events[0], generation);
    return;
  }
  const queue2 = root.undelivered = {
    events,
    next: 0,
    generation,
    changeAt: -1,
    changeGeneration: 0,
    marks: undefined
  };
  let current = generation;
  let mark = 0;
  let failed = false;
  let failure;
  try {
    while (queue2.next < queue2.events.length) {
      const index = queue2.next++;
      if (index === queue2.changeAt)
        current = queue2.changeGeneration;
      else if (queue2.marks !== undefined && mark < queue2.marks.length && queue2.marks[mark] === index) {
        current = queue2.marks[mark + 1];
        mark += 2;
      }
      try {
        emitListener(emit, queue2.events[index], current);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  } finally {
    root.undelivered = undefined;
  }
  if (failed)
    throw failure;
}
function copiesRemoved(target) {
  return target.root.async || target.root.undelivered !== undefined || target.paths.length > 1;
}
function copyPayload(event, target, container, held) {
  if (event === undefined)
    return 1 /* Done */;
  const removed = copiesRemoved(target);
  const { newValue, oldValue, value, items, oldValues } = event;
  const stored = event.action !== "set-delete";
  let fresh = true;
  let newCopy = newValue;
  if (isObject2(newValue)) {
    newCopy = held === undefined ? cloneStored(newValue, container, event.action === "replace" ? 1 /* Below */ : 0 /* None */) : cloneTreeUnless(newValue, container, event.action === "replace" ? 1 /* Below */ : 0 /* None */);
    if (newCopy === REACHES)
      return 0 /* Reaches */;
    fresh = held === undefined && copiedFresh;
  }
  let valueCopy = value;
  if (isObject2(value) && stored) {
    valueCopy = cloneStored(value, container, 2 /* All */);
    if (valueCopy === REACHES)
      return 0 /* Reaches */;
    fresh &&= copiedFresh;
  }
  let itemsCopy = items;
  if (items !== undefined && holdsObject(items)) {
    itemsCopy = cloneStored(items, container, 1 /* Below */);
    if (itemsCopy === REACHES)
      return 0 /* Reaches */;
    fresh &&= copiedFresh;
  }
  if (removed) {
    const oldCopy = isObject2(oldValue) ? cloneTree(oldValue, 2 /* All */) : oldValue;
    const oldValuesCopy = oldValues !== undefined && holdsObject(oldValues) ? cloneTree(oldValues, 1 /* Below */) : oldValues;
    if (isObject2(oldValue))
      event.oldValue = oldCopy;
    if (oldValues !== undefined)
      event.oldValues = oldValuesCopy;
    if (!stored)
      valueCopy = event.oldValue;
  }
  if (isObject2(newValue))
    event.newValue = newCopy;
  if (isObject2(value))
    event.value = nameMember(value, valueCopy, container, stored);
  if (items !== undefined)
    event.items = itemsCopy;
  return fresh ? 2 /* Fresh */ : 1 /* Done */;
}
function copyPayloadReaching(event, target, container, after) {
  refuseAccessors(event, copiesRemoved(target), container, after);
  copyPayloadAfter(event, target, container, after);
}
function copyPayloadAfter(event, target, container, after) {
  const { newValue, oldValue, value, items, oldValues } = event;
  const removed = copiesRemoved(target);
  const stored = event.action !== "set-delete";
  const newCopy = isObject2(newValue) ? cloneTreeAfter(newValue, container, after, event.action === "replace" ? 1 /* Below */ : 0 /* None */) : newValue;
  const oldCopy = removed && isObject2(oldValue) ? cloneTree(oldValue, 2 /* All */) : oldValue;
  const valueCopy = !isObject2(value) ? value : stored ? cloneTreeAfter(value, container, after, 2 /* All */) : oldCopy;
  const itemsCopy = items !== undefined && holdsObject(items) ? cloneTreeAfter(items, container, after, 1 /* Below */) : items;
  const oldValuesCopy = removed && oldValues !== undefined && holdsObject(oldValues) ? cloneTree(oldValues, 1 /* Below */) : oldValues;
  if (isObject2(newValue))
    event.newValue = newCopy;
  if (isObject2(oldValue))
    event.oldValue = oldCopy;
  if (isObject2(value))
    event.value = nameMember(value, valueCopy, container, stored);
  if (items !== undefined)
    event.items = itemsCopy;
  if (oldValues !== undefined)
    event.oldValues = oldValuesCopy;
}
function holdsObject(values) {
  for (let i = 0;i < values.length; i++)
    if (isObject2(values[i]))
      return true;
  return false;
}
function shallowCopy(container) {
  const copy = Array.isArray(container) ? container.slice() : container instanceof Map ? new Map(Map.prototype.entries.call(container)) : container instanceof Set ? new Set(Set.prototype.values.call(container)) : Object.create(Object.getPrototypeOf(container));
  const keys = Reflect.ownKeys(container);
  for (let i = 0;i < keys.length; i++) {
    const value = enumerableData(container, keys[i]);
    if (value !== NOT_ENUMERABLE)
      setData(copy, keys[i], value);
  }
  return copy;
}
var NOT_ENUMERABLE = Symbol("not enumerable");
function enumerableData(object, key) {
  const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
  if (!descriptor.enumerable)
    return NOT_ENUMERABLE;
  if (descriptor.get !== undefined || descriptor.set !== undefined) {
    throw new UnsupportedStateError(`the accessor property '${String(key)}' sits in a payload that reaches back into the ` + `object it is written to, and a getter cannot be read as it will be after the write`);
  }
  return descriptor.value;
}
function refuseAccessors(event, removed, container, after) {
  const pending = [event.newValue];
  if (event.action !== "set-delete")
    pending.push(event.value);
  if (event.items !== undefined)
    pending.push(event.items);
  if (removed) {
    pending.push(event.oldValue);
    if (event.oldValues !== undefined)
      pending.push(event.oldValues);
  }
  const seen = new Set;
  while (pending.length > 0) {
    const entry = pending.pop();
    if (!isObject2(entry))
      continue;
    let value = toRaw(entry);
    if (value === container)
      value = after;
    if (seen.has(value))
      continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0;i < value.length; i++)
        pending.push(value[i]);
    } else if (value instanceof Map) {
      for (const [key, item] of Map.prototype.entries.call(value))
        pending.push(key, item);
    } else if (value instanceof Set) {
      for (const item of Set.prototype.values.call(value))
        pending.push(item);
    }
    const keys = Reflect.ownKeys(value);
    for (let i = 0;i < keys.length; i++) {
      const item = enumerableData(value, keys[i]);
      if (item !== NOT_ENUMERABLE)
        pending.push(item);
    }
  }
}
function addPlace(node, parent, key) {
  if (findPlace(node, parent, key) !== undefined)
    return false;
  pushPlace(node, new Place(parent, key));
  return true;
}
function findPlace(node, parent, key) {
  const places = node.places;
  if (places.length <= WIDE) {
    for (let i = 0;i < places.length; i++) {
      if (samePlace(places[i], parent, key))
        return places[i];
    }
    return;
  }
  let index = node.index;
  if (index === undefined || index.places !== places || index.length !== places.length) {
    index = node.index = { places, length: places.length, byParent: new Map };
    for (let i = 0;i < places.length; i++)
      indexPlace(index.byParent, places[i]);
  }
  const entry = index.byParent.get(parent.id);
  if (entry === undefined)
    return;
  if (entry instanceof Place)
    return parent.kind === 2 /* Set */ || entry.key === key ? entry : undefined;
  return entry.get(key);
}
function indexPlace(byParent, place) {
  const entry = byParent.get(place.parentId);
  if (entry === undefined)
    byParent.set(place.parentId, place);
  else if (entry instanceof Place) {
    if (entry.key !== place.key)
      byParent.set(place.parentId, new Map([[entry.key, entry], [place.key, place]]));
  } else if (!entry.has(place.key))
    entry.set(place.key, place);
}
function pushPlace(node, place) {
  const places = node.places;
  places.push(place);
  const index = node.index;
  if (index !== undefined && index.places === places && index.length === places.length - 1) {
    index.length++;
    indexPlace(index.byParent, place);
  }
}
function prunePlaces(node) {
  const count = node.places.length;
  if (count > WIDE && count < 2 * node.pruned)
    return;
  let places = keepPlaces(node.places, (place) => holds(place, node.raw));
  if (places.length > 1) {
    const live = pruneScratch;
    live.length = places.length;
    let attached = 0;
    let parent;
    let parentAttached = false;
    for (let i = 0;i < places.length; i++) {
      const next = places[i].parent;
      if (next !== parent) {
        parent = next;
        parentAttached = isAttached(next);
      }
      live[i] = parentAttached;
      if (parentAttached)
        attached++;
    }
    if (attached > 0 && attached < places.length) {
      const kept = [];
      for (let i = 0;i < places.length; i++) {
        if (live[i])
          kept.push(places[i]);
        else {
          markLostLink(places[i].parent);
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
var pruneScratch = [];
function keepPlaces(places, keep) {
  const kept = [];
  for (let i = 0;i < places.length; i++) {
    if (keep(places[i]))
      kept.push(places[i]);
    else
      dropped(places[i]);
  }
  return kept;
}
function markLostLink(node) {
  if (node.lostLink)
    return;
  node.lostLink = true;
  const pending = [node];
  while (pending.length > 0) {
    const places = pending.pop().places;
    for (let i = 0;i < places.length; i++) {
      const parent = places[i].parent;
      if (parent !== undefined && !parent.lostLink) {
        parent.lostLink = true;
        pending.push(parent);
      }
    }
  }
}
function notePlace(node, parent, key) {
  const places = node.places;
  if (places.length === 1 && samePlace(places[0], parent, key))
    return;
  if (addPlace(node, parent, key) && node.places.length > 1)
    prunePlaces(node);
}
function detachPlace(value, parent, key) {
  const node = nodes.get(value);
  if (node !== undefined)
    removePlace(node, parent, key);
}
function removePlace(node, parent, key) {
  const places = node.places;
  if (places.length <= WIDE) {
    for (let i = 0;i < places.length; i++) {
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
  if (place === undefined)
    return false;
  const at = places.indexOf(place);
  if (at < 0) {
    node.index = undefined;
    return false;
  }
  dropped(place);
  places.splice(at, 1);
  const index = node.index;
  index.length--;
  const entry = index.byParent.get(place.parentId);
  if (entry === place)
    index.byParent.delete(place.parentId);
  else if (entry instanceof Map && entry.get(place.key) === place)
    entry.delete(place.key);
  return true;
}
function newWalk(touched, store, former, held, first) {
  return {
    id: ++stamps,
    store,
    firstId: nodeCount + 1,
    touched,
    seen: new Set,
    repeated: undefined,
    aliases: first?.repeated,
    created: undefined,
    revisit: first?.created,
    relinked: [],
    former,
    held
  };
}
function adoptFrame(raw, node, unknown, key) {
  let kind = 3 /* Object */;
  let keys;
  let entries;
  if (Array.isArray(raw))
    kind = 0 /* Array */;
  else if (raw instanceof Map) {
    kind = 1 /* Map */;
    entries = Map.prototype.entries.call(raw);
  } else if (raw instanceof Set) {
    kind = 2 /* Set */;
    entries = Set.prototype.values.call(raw);
  } else if (raw instanceof Date || ArrayBuffer.isView(raw))
    kind = 4 /* None */;
  else
    keys = Object.keys(raw);
  return { raw, node, unknown, key, kind, next: 0, keys, entries, childKey: undefined, swaps: undefined };
}
function nextChild(frame) {
  const raw = frame.raw;
  switch (frame.kind) {
    case 0 /* Array */:
      while (frame.next < raw.length) {
        const index = frame.next++;
        const child = raw[index];
        if (isObject2(child)) {
          frame.childKey = index;
          return child;
        }
      }
      return;
    case 1 /* Map */:
      for (;; ) {
        const step = frame.entries.next();
        if (step.done)
          return;
        const child = step.value[1];
        if (isObject2(child)) {
          frame.childKey = step.value[0];
          return child;
        }
      }
    case 2 /* Set */:
      for (;; ) {
        const step = frame.entries.next();
        if (step.done)
          return;
        if (isObject2(step.value)) {
          frame.childKey = undefined;
          return step.value;
        }
      }
    case 3 /* Object */: {
      const keys = frame.keys;
      while (frame.next < keys.length) {
        const key = keys[frame.next++];
        const child = raw[key];
        if (isObject2(child)) {
          frame.childKey = key;
          return child;
        }
      }
      return;
    }
    default:
      return;
  }
}
function enterAdopt(raw, key, walk, frames) {
  let node = nodes.get(raw);
  if (node !== undefined) {
    if (node.walk === walk.id)
      return node;
    node.walk = walk.id;
    if (!node.lostLink && walk.revisit?.has(raw) !== true) {
      if (attachedBefore(node, walk.former))
        return node;
      if (walk.aliases === undefined)
        (walk.created ??= new Set).add(raw);
    }
    if (node.lostLink)
      walk.relinked.push(node);
    frames.push(adoptFrame(raw, node, false, key));
    return node;
  }
  if (raw["__v_skip" /* SKIP */])
    return;
  if (raw["__v_isReactive" /* IS_REACTIVE */]) {
    const target = toRaw(raw);
    if (frames.length > 0)
      storeRaw(frames[frames.length - 1], key, raw, target);
    return enterAdopt(target, key, walk, frames);
  }
  const seen = walk.seen;
  const size = seen.size;
  seen.add(raw);
  if (seen.size === size) {
    (walk.repeated ??= new Set).add(raw);
    return;
  }
  if (walk.aliases?.has(raw))
    node = walkNode(raw, walk);
  if (walk.held?.has(raw))
    return node;
  frames.push(adoptFrame(raw, node, true, key));
  return node;
}
function walkNode(raw, walk) {
  const node = ensureLocationNode(raw);
  node.walk = walk.id;
  return node;
}
function storeRaw(frame, key, proxy, target) {
  const container = frame.raw;
  switch (frame.kind) {
    case 1 /* Map */:
      Map.prototype.set.call(container, key, target);
      return;
    case 2 /* Set */:
      (frame.swaps ??= new Map).set(proxy, target);
      return;
    default: {
      const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
      if (descriptor !== undefined && descriptor.value === proxy)
        Reflect.set(container, key, target);
    }
  }
}
function swapMembers(set, swaps) {
  const members = Array.from(Set.prototype.values.call(set));
  Set.prototype.clear.call(set);
  for (let i = 0;i < members.length; i++) {
    const member = members[i];
    Set.prototype.add.call(set, isObject2(member) && swaps.get(member) || member);
  }
}
function placeChild(frame, key, childNode, walk) {
  if (childNode === undefined)
    return;
  const parent = frame.node ??= walkNode(frame.raw, walk);
  if (parent.id < walk.firstId && childNode.id < walk.firstId) {
    if (walk.aliases !== undefined && !walk.aliases.has(childNode.raw))
      return;
    if (!addPlace(childNode, parent, key))
      return;
  } else {
    pushPlace(childNode, new Place(parent, key));
  }
  touch(childNode, walk.store, walk.touched);
}
function touch(node, store, touched) {
  if (node.touched === store)
    return;
  node.touched = store;
  touched.push(node);
}
var stamps = 0;
function walkFrames(frames, walk) {
  for (;; ) {
    const frame = frames[frames.length - 1];
    const child = nextChild(frame);
    if (child !== undefined) {
      const depth = frames.length;
      const childNode = enterAdopt(child, frame.childKey, walk, frames);
      if (frames.length === depth)
        placeChild(frame, frame.childKey, childNode, walk);
      continue;
    }
    frames.pop();
    if (frame.swaps !== undefined)
      swapMembers(frame.raw, frame.swaps);
    const node = frame.node;
    if (frame.unknown && node !== undefined && walk.aliases === undefined)
      (walk.created ??= new Set).add(frame.raw);
    if (frames.length === 0)
      return node;
    placeChild(frames[frames.length - 1], frame.key, node, walk);
  }
}
function adopt(raw, walk) {
  const frames = [];
  const node = enterAdopt(raw, undefined, walk, frames);
  return frames.length === 0 ? node : walkFrames(frames, walk);
}
function adoptAll(touched, store, former, held, visit) {
  let walk = newWalk(touched, store, former, held);
  visit(walk);
  if (walk.repeated !== undefined) {
    const first = walk;
    walk = newWalk(touched, store, former, held, first);
    visit(walk);
    for (let i = 0;i < first.relinked.length; i++)
      first.relinked[i].lostLink = false;
  }
  for (let i = 0;i < walk.relinked.length; i++)
    walk.relinked[i].lostLink = false;
}
function pruneTouched(touched) {
  for (let i = 0;i < touched.length; i++) {
    if (touched[i].places.length > 1)
      prunePlaces(touched[i]);
  }
}
function hasObjectChild(raw) {
  if (Array.isArray(raw)) {
    for (let i = 0;i < raw.length; i++)
      if (isObject2(raw[i]))
        return true;
    return false;
  }
  if (Object.getPrototypeOf(raw) !== Object.prototype) {
    if (raw instanceof Map || raw instanceof Set) {
      const entries = raw instanceof Map ? Map.prototype.values.call(raw) : Set.prototype.values.call(raw);
      for (const child of entries)
        if (isObject2(child))
          return true;
      return false;
    }
    if (raw instanceof Date || ArrayBuffer.isView(raw))
      return false;
  }
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && isObject2(raw[key]))
      return true;
  }
  return false;
}
function insertedNeedWalk(inserted) {
  let fresh;
  for (let i = 0;i < inserted.length; i++) {
    const value = inserted[i];
    if (!isObject2(value))
      continue;
    const node = nodes.get(value);
    if (node !== undefined) {
      if (node.lostLink || !attachedBefore(node, undefined))
        return true;
      continue;
    }
    if (hasObjectChild(value))
      return true;
    if (inserted.length > 1) {
      if (fresh === undefined)
        fresh = new Set;
      else if (fresh.has(value))
        return true;
      fresh.add(value);
    }
  }
  return false;
}
function heldBefore(value, replaced) {
  if (!Array.isArray(value) || !Array.isArray(replaced))
    return;
  let before;
  for (let i = 0;i < value.length; i++) {
    const item = value[i];
    if (!isObject2(item) || nodes.get(item) !== undefined)
      continue;
    if (before === undefined) {
      if (replaced.indexOf(item) === -1)
        return;
      before = new Set;
      for (let j = 0;j < replaced.length; j++)
        if (isObject2(replaced[j]))
          before.add(replaced[j]);
    }
    if (!before.has(item))
      return;
  }
  return before;
}
function heldItems(value, replaced) {
  if (!isObject2(value) || !isObject2(replaced) || nodes.get(replaced) === undefined)
    return;
  return heldBefore(value, replaced);
}
function attachValue(value, parent, key, fresh, replaced, held) {
  if (fresh)
    return;
  const former = isObject2(replaced) ? nodes.get(replaced) : undefined;
  const existing = nodes.get(value);
  if (existing !== undefined && !existing.lostLink && attachedBefore(existing, former)) {
    if (addPlace(existing, parent, key) && existing.places.length > 1)
      prunePlaces(existing);
    return;
  }
  if (existing === undefined && !hasObjectChild(value))
    return;
  const touched = [];
  const store = ++stamps;
  adoptAll(touched, store, former, held, (walk) => {
    const node = adopt(value, walk);
    if (node !== undefined && addPlace(node, parent, key))
      touch(node, store, touched);
  });
  pruneTouched(touched);
}
function adoptRoot(node) {
  const touched = [];
  adoptAll(touched, ++stamps, undefined, undefined, (walk) => {
    node.walk = walk.id;
    walkFrames([adoptFrame(node.raw, node, false, undefined)], walk);
  });
  pruneTouched(touched);
}
function relinkArray(arrayNode, array, from, removed, inserted, insertedFresh = false) {
  if (insertedFresh)
    inserted = undefined;
  relink(arrayNode, array, from, removed, inserted, false);
}
function relinkReorder(arrayNode, array, removed, inserted) {
  relink(arrayNode, array, 0, removed, inserted, true);
}
function relink(arrayNode, array, from, removed, inserted, findAliases) {
  const touched = [];
  const store = ++stamps;
  if (inserted !== undefined && insertedNeedWalk(inserted)) {
    adoptAll(touched, store, undefined, undefined, (walk) => {
      for (let i = 0;i < inserted.length; i++) {
        const value = inserted[i];
        if (isObject2(value))
          adopt(value, walk);
      }
    });
  }
  let removedNode = false;
  if (removed !== undefined) {
    for (let i = 0;i < removed.length; i++) {
      const value = removed[i];
      if (isObject2(value)) {
        const node = nodes.get(value);
        if (node !== undefined) {
          stripIndexes(node, arrayNode, from);
          removedNode = true;
        }
      }
    }
  }
  const call = ++relinkCalls;
  let firstIndex;
  let left = findAliases || removedNode || holdsNode(inserted) ? Infinity : arrayNode.childPlaces;
  for (let i = from;i < array.length && left > 0; i++) {
    const value = array[i];
    if (!isObject2(value))
      continue;
    let node = nodes.get(value);
    if (node === undefined) {
      if (!findAliases)
        continue;
      const first = (firstIndex ??= new Map).get(value);
      if (first === undefined) {
        firstIndex.set(value, i);
        continue;
      }
      if (value["__v_skip" /* SKIP */])
        continue;
      node = ensureLocationNode(value);
      node.relinked = call;
      node.relinkedPlaces = 0;
      node.places.push(new Place(arrayNode, first));
    } else if (node.relinked !== call) {
      node.relinked = call;
      const places = node.places;
      if (places.length === 1 && places[0].parentId === arrayNode.id && typeof places[0].key === "number" && places[0].key >= from) {
        places[0].key = i;
        node.relinkedPlaces = 0;
        left--;
        continue;
      }
      node.relinkedPlaces = stripIndexes(node, arrayNode, from);
    }
    if (node.relinkedPlaces > 0) {
      node.relinkedPlaces--;
      left--;
    }
    node.places.push(new Place(arrayNode, i));
    if (node.places.length > 1)
      touch(node, store, touched);
  }
  pruneTouched(touched);
}
var relinkCalls = 0;
function holdsNode(values) {
  if (values === undefined)
    return false;
  for (let i = 0;i < values.length; i++) {
    const value = values[i];
    if (isObject2(value) && nodes.get(value) !== undefined)
      return true;
  }
  return false;
}
function stripIndexes(node, arrayNode, from) {
  const places = node.places;
  let count = 0;
  for (let i = places.length - 1;i >= 0; i--) {
    const place = places[i];
    if (place.parentId === arrayNode.id && typeof place.key === "number" && place.key >= from) {
      arrayNode.childPlaces--;
      places.splice(i, 1);
      count++;
    }
  }
  if (count > 0)
    node.index = undefined;
  return count;
}
function evictDeep(value, parent) {
  if (value == null || typeof value !== "object")
    return;
  const top = toRaw(value);
  if (globalSeen.get(top) === undefined)
    return;
  const pending = [parent, undefined, top];
  while (pending.length > 0) {
    const raw = pending.pop();
    const key = pending.pop();
    const container = pending.pop();
    const proxy = globalSeen.get(raw);
    if (proxy === undefined)
      continue;
    const node = nodes.get(raw);
    if (node !== undefined) {
      const places = node.places;
      const onlyUnderParent = container !== undefined && node.root === undefined && places.length === 1 && places[0].parentId === container.id;
      if (!onlyUnderParent) {
        if (container !== undefined && places.length > 1 && removePlace(node, container, key))
          markLostLink(container);
        if (isAttached(node))
          continue;
      }
      node.proxy = undefined;
      node.evicted = new WeakRef(proxy);
    }
    globalSeen.delete(raw);
    wrapperCache.delete(raw);
    proxyStats.staleEvicted++;
    if (Array.isArray(raw)) {
      for (let i = 0;i < raw.length; i++)
        pushProxied(raw[i], node, i, pending);
    } else if (raw instanceof Map) {
      Map.prototype.forEach.call(raw, (child, key2) => pushProxied(child, node, key2, pending));
    } else if (raw instanceof Set) {
      for (const child of Set.prototype.values.call(raw))
        pushProxied(child, node, undefined, pending);
    } else {
      const keys = Object.keys(raw);
      for (let i = 0;i < keys.length; i++)
        pushProxied(raw[keys[i]], node, keys[i], pending);
    }
  }
}
function pushProxied(value, container, key, pending) {
  if (value === null || typeof value !== "object")
    return;
  const raw = toRaw(value);
  if (globalSeen.get(raw) !== undefined)
    pending.push(container, key, raw);
}
function restoreEvicted(node) {
  const proxy = node.evicted?.deref();
  node.evicted = undefined;
  if (proxy === undefined)
    return;
  node.proxy = proxy;
  globalSeen.set(node.raw, proxy);
  wrapperCache.set(node.raw, proxy);
  proxyStats.staleEvicted--;
  return proxy;
}

// src/wrap-array.ts
function isObject3(v) {
  return v && typeof v === "object";
}
function placeKey(prop) {
  const index = arrayIndex(prop);
  return index >= 0 ? index : prop;
}
function toIntegerOrInfinity(value) {
  const number = +value;
  if (number !== number || number === 0)
    return 0;
  return Math.trunc(number);
}
function clampIndex(relative, length) {
  return relative < 0 ? Math.max(length + relative, 0) : Math.min(relative, length);
}
function unwrapItems(items) {
  for (let i = 0;i < items.length; i++) {
    if (isObject3(items[i]))
      items[i] = unwrapForStore(items[i]);
  }
}
function planReorder(target, prop, method, args) {
  const length = target.length;
  if (prop === "fill" || prop === "copyWithin") {
    const fill2 = prop === "fill";
    const to = fill2 ? 0 : clampIndex(toIntegerOrInfinity(args[0]), length);
    const start = clampIndex(toIntegerOrInfinity(args[1]), length);
    const end = args[2] === undefined ? length : clampIndex(toIntegerOrInfinity(args[2]), length);
    const after2 = target.slice();
    method.call(after2, fill2 ? args[0] : to, start, end);
    const size = after2.length;
    if (fill2)
      return { after: after2, first: Math.min(start, size), last: Math.min(end, size), skip: -1 };
    const from = Math.min(to, size);
    const count = Math.min(Math.min(end, size) - Math.min(start, size), size - from);
    return { after: after2, first: from, last: from + Math.max(count, 0), skip: -1 };
  }
  const after = target.slice();
  method.apply(after, args);
  if (prop === "reverse") {
    return { after, first: 0, last: length, skip: length % 2 === 1 ? (length - 1) / 2 : -1 };
  }
  const sorted = length < 2 ? 0 : length;
  for (let i = length;i < target.length; i++) {
    if (i in target)
      after[i] = target[i];
    else
      after.length = i + 1;
  }
  return { after, first: 0, last: sorted, skip: -1 };
}
var strictWrites = function() {
  return this === undefined;
}();
function checkReorder(target, reorder) {
  const { after, first, last, skip } = reorder;
  let extensible;
  for (let i = first;i < last; i++) {
    if (i === skip)
      continue;
    if (i in after) {
      if (i in target) {
        if (strictWrites)
          target[i] = target[i];
        else if (!Reflect.set(target, i, target[i]))
          throw new TypeError(`Cannot assign to read only property '${i}' of array`);
      } else if (!(extensible ??= Object.isExtensible(target))) {
        throw new TypeError(`Cannot add property ${i}, array is not extensible`);
      }
    } else if (i in target && !Reflect.getOwnPropertyDescriptor(target, i).configurable) {
      throw new TypeError(`Cannot delete property '${i}' of array`);
    }
  }
}
function reorderChanges(target, after) {
  if (after.length !== target.length)
    return true;
  for (let i = 0;i < after.length; i++) {
    const value = after[i];
    const current = target[i];
    if (value !== current) {
      if (value === value || current === current)
        return true;
    } else if (value === 0) {
      if (1 / value !== 1 / current)
        return true;
    } else if (value === undefined && i in after !== i in target) {
      return true;
    }
  }
  return false;
}
function writeReorder(target, reorder) {
  const { after, first, last, skip } = reorder;
  for (let i = first;i < last; i++) {
    if (i === skip)
      continue;
    if (i in after)
      target[i] = after[i];
    else
      delete target[i];
  }
}
var notRead = Symbol("notRead");
function isName(prop) {
  return typeof prop === "symbol" || prop !== "length" && isNaN(parseInt(prop));
}
var noItems = [];
function readerOf(target, method) {
  return function() {
    trackIteration(target);
    return method.apply(target, arguments);
  };
}
function evictRemoved(removed) {
  for (let i = 0;i < removed.length; i++) {
    if (isObject3(removed[i]))
      evictDeep(removed[i]);
  }
}
function trackIteration(target) {
  if (activeEffect !== null)
    track(target, Symbol.iterator);
}
class ArrayProxyIterator {
  node;
  kind;
  target;
  index = 0;
  constructor(target, node, kind) {
    this.node = node;
    this.kind = kind;
    this.target = target;
  }
  next() {
    const target = this.target;
    if (target !== undefined) {
      if (activeEffect !== null)
        track(target, Symbol.iterator);
      const index = this.index;
      if (index < target.length) {
        this.index = index + 1;
        const kind = this.kind;
        if (kind === 1 /* Keys */)
          return { value: index, done: false };
        const value = target[index];
        const item = isObject3(value) ? wrapChild(value, this.node, index) : value;
        return { value: kind === 0 /* Values */ ? item : [index, item], done: false };
      }
      this.target = undefined;
    }
    return { value: undefined, done: true };
  }
}
Object.setPrototypeOf(ArrayProxyIterator.prototype, Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));
function wrapArray(arr, node) {
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(arr))
    return globalSeen.get(arr);
  const methodCache = newMethodCache();
  let otherReaders;
  const handler = {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */)
        return target;
      if (prop === "__v_isReactive" /* IS_REACTIVE */)
        return true;
      track(target, prop);
      if (typeof prop === "string") {
        const first = prop.charCodeAt(0);
        if (first <= 57 && first >= 48) {
          const index = arrayIndex(prop);
          if (index >= 0) {
            const value2 = Reflect.get(target, prop, receiver);
            if (!isObject3(value2))
              return value2;
            return wrapChild(value2, node, index);
          }
        } else if (prop === "length") {
          return Reflect.get(target, prop, receiver);
        }
      }
      const cached = methodCache[prop];
      if (cached !== undefined)
        return cached;
      let read = notRead;
      if (otherReaders !== undefined) {
        const kept = otherReaders.get(prop);
        if (kept !== undefined) {
          read = Reflect.get(target, prop, receiver);
          if (kept[0] === read)
            return kept[1];
        }
      }
      switch (prop) {
        case "sort":
        case "reverse":
        case "fill":
        case "copyWithin": {
          if (hasOwn.call(target, prop))
            break;
          const method = Array.prototype[prop];
          methodCache[prop] = function(...args) {
            if (prop === "fill" && isObject3(args[0]))
              args[0] = unwrapForStore(args[0]);
            const reorder = planReorder(target, prop, method, args);
            const before = target.slice();
            checkReorder(target, reorder);
            const after = reorder.after;
            if (!reorderChanges(target, after))
              return proxy;
            const located = locate(node);
            const event = located && {
              action: "replace",
              path: located.paths[0],
              oldValue: before,
              newValue: target
            };
            if (event !== undefined)
              copyPayloadAfter(event, located, target, after);
            writeReorder(target, reorder);
            relinkReorder(node, target, before, prop === "fill" ? [args[0]] : undefined);
            beginWrite();
            try {
              triggerArray(target, reorder.first, reorder.last, false, before);
              if (event !== undefined)
                dispatch(located, event);
            } finally {
              try {
                evictRemoved(before);
              } finally {
                endWrite();
              }
            }
            return proxy;
          };
          return methodCache[prop];
        }
        case "push":
          if (hasOwn.call(target, prop))
            break;
          methodCache[prop] = function(...items) {
            unwrapItems(items);
            const oldLength = target.length;
            const located = items.length > 0 ? locate(node) : undefined;
            const event = located && {
              action: "array-push",
              path: located.paths[0],
              key: oldLength,
              items
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              const after = target.slice();
              after.push(...items);
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              relinkArray(node, target, oldLength, undefined, items, copied === 2 /* Fresh */);
              beginWrite();
              try {
                triggerArray(target, oldLength, newLength, oldLength !== newLength);
                if (event !== undefined)
                  dispatch(located, event);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "pop":
          if (hasOwn.call(target, prop))
            break;
          methodCache[prop] = function() {
            if (target.length === 0)
              return;
            const oldLength = target.length;
            const poppedIndex = oldLength - 1;
            const oldValue = target[poppedIndex];
            const located = locate(node);
            const event = located && {
              action: "array-pop",
              path: located.paths[0],
              key: poppedIndex,
              oldValue
            };
            if (copyPayload(event, located, target) === 0 /* Reaches */) {
              const after = target.slice();
              after.pop();
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.pop();
            const newLength = target.length;
            if (isObject3(oldValue))
              detachPlace(oldValue, node, poppedIndex);
            beginWrite();
            try {
              triggerArray(target, newLength, oldLength, oldLength !== newLength);
              if (event !== undefined)
                dispatch(located, event);
            } finally {
              try {
                if (isObject3(oldValue))
                  evictDeep(oldValue);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "shift":
          if (hasOwn.call(target, prop))
            break;
          methodCache[prop] = function() {
            if (target.length === 0)
              return;
            const oldLength = target.length;
            const oldValue = target[0];
            const removed = 0 in target ? [oldValue] : new Array(1);
            const located = locate(node);
            const event = located && {
              action: "array-shift",
              path: located.paths[0],
              key: 0,
              oldValue
            };
            if (copyPayload(event, located, target) === 0 /* Reaches */) {
              const after = target.slice();
              after.shift();
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.shift();
            relinkArray(node, target, 0, removed);
            beginWrite();
            try {
              triggerSplice(target, 0, removed, 0, oldLength);
              if (event !== undefined)
                dispatch(located, event);
            } finally {
              try {
                if (isObject3(oldValue))
                  evictDeep(oldValue);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "unshift":
          if (hasOwn.call(target, prop))
            break;
          methodCache[prop] = function(...items) {
            unwrapItems(items);
            const oldLength = target.length;
            const located = items.length > 0 ? locate(node) : undefined;
            const event = located && {
              action: "array-unshift",
              path: located.paths[0],
              key: 0,
              items
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              const after = target.slice();
              after.unshift(...items);
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.unshift(...items);
            if (items.length > 0) {
              relinkArray(node, target, 0, undefined, items, copied === 2 /* Fresh */);
              beginWrite();
              try {
                triggerSplice(target, 0, noItems, items.length, oldLength);
                if (event !== undefined)
                  dispatch(located, event);
              } finally {
                endWrite();
              }
            }
            return result;
          };
          return methodCache[prop];
        case "splice":
          if (hasOwn.call(target, prop))
            break;
          methodCache[prop] = function(...args) {
            const oldLength = target.length;
            const actualStart = args.length === 0 ? 0 : clampIndex(toIntegerOrInfinity(args[0]), oldLength);
            const actualDeleteCount = args.length === 0 ? 0 : args.length === 1 ? oldLength - actualStart : Math.min(Math.max(toIntegerOrInfinity(args[1]), 0), oldLength - actualStart);
            const items = args.length > 2 ? args.slice(2) : [];
            unwrapItems(items);
            const changes = actualDeleteCount > 0 || items.length > 0;
            const located = changes ? locate(node) : undefined;
            const event = located && {
              action: "array-splice",
              path: located.paths[0],
              key: actualStart,
              deleteCount: actualDeleteCount,
              items: items.length > 0 ? items : undefined,
              oldValues: actualDeleteCount > 0 ? target.slice(actualStart, actualStart + actualDeleteCount) : undefined
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              const after = target.slice();
              after.splice(actualStart, actualDeleteCount, ...items);
              copyPayloadReaching(event, located, target, after);
            }
            const deletedItems = target.splice(actualStart, actualDeleteCount, ...items);
            if (changes) {
              relinkArray(node, target, actualStart, deletedItems, items, copied === 2 /* Fresh */);
              beginWrite();
              try {
                triggerSplice(target, actualStart, deletedItems, items.length, oldLength);
                if (event !== undefined)
                  dispatch(located, event);
              } finally {
                try {
                  evictRemoved(deletedItems);
                } finally {
                  endWrite();
                }
              }
            }
            return deletedItems;
          };
          return methodCache[prop];
        case "find":
        case "findLast": {
          if (hasOwn.call(target, prop))
            break;
          const findIndex = prop === "find" ? Array.prototype.findIndex : Array.prototype.findLastIndex;
          methodCache[prop] = function(predicate, thisArg) {
            trackIteration(target);
            const idx = findIndex.call(target, predicate, thisArg);
            if (idx === -1)
              return;
            const value2 = target[idx];
            if (!isObject3(value2))
              return value2;
            return wrapChild(value2, node, idx);
          };
          return methodCache[prop];
        }
        case "indexOf":
        case "lastIndexOf":
        case "includes": {
          if (hasOwn.call(target, prop))
            break;
          const method = Array.prototype[prop];
          methodCache[prop] = function(searched, fromIndex) {
            trackIteration(target);
            const from = arguments.length > 1;
            const result = from ? method.call(target, searched, fromIndex) : method.call(target, searched);
            if (result !== -1 && result !== false)
              return result;
            if (!isObject3(searched) || !searched["__v_isReactive" /* IS_REACTIVE */])
              return result;
            const raw = toRaw(searched);
            return from ? method.call(target, raw, fromIndex) : method.call(target, raw);
          };
          return methodCache[prop];
        }
        case "at": {
          if (hasOwn.call(target, prop))
            break;
          methodCache[prop] = function(index) {
            trackIteration(target);
            let idx = Number(index);
            if (!Number.isInteger(idx))
              idx = Math.trunc(idx);
            if (idx < 0)
              idx = target.length + idx;
            if (idx < 0 || idx >= target.length)
              return;
            const value2 = target[idx];
            if (!isObject3(value2))
              return value2;
            return wrapChild(value2, node, idx);
          };
          return methodCache[prop];
        }
        case Symbol.iterator:
        case "values":
        case "entries":
        case "keys": {
          if (hasOwn.call(target, prop))
            break;
          const kind = prop === "entries" ? 2 /* Entries */ : prop === "keys" ? 1 /* Keys */ : 0 /* Values */;
          methodCache[prop] = function() {
            trackIteration(target);
            return new ArrayProxyIterator(target, node, kind);
          };
          return methodCache[prop];
        }
      }
      const value = read !== notRead ? read : Reflect.get(target, prop, receiver);
      const isNumericIndex = typeof prop === "string" && !isNaN(parseInt(prop, 10));
      if (isNumericIndex) {
        if (!isObject3(value))
          return value;
        return wrapChild(value, node, placeKey(prop));
      }
      if (typeof value === "function") {
        if (prop === "constructor" || prop === "valueOf")
          return value;
        if (hasOwn.call(Array.prototype, prop) && Array.prototype[prop] === value) {
          return methodCache[prop] = readerOf(target, value);
        }
        const method = readerOf(target, value);
        (otherReaders ??= new Map).set(prop, [value, method]);
        return method;
      }
      return value;
    },
    set(target, prop, value, receiver, descriptor) {
      const foreign = receiver !== proxy;
      const setter = isName(prop) ? setterOf(target, prop, hasOwn.call(target, prop), node) : undefined;
      if (foreign && setter === undefined)
        return Reflect.set(target, prop, value, receiver);
      if (isObject3(value))
        value = unwrapForStore(value);
      const oldValue = target[prop];
      if (setter !== undefined && descriptor === undefined) {
        const forwards = !foreign || forwardsTo(receiver, target);
        if (forwards && setter.get !== undefined && (oldValue === value || isObject3(oldValue) && isObject3(value) && deepEqual(oldValue, value)))
          return true;
        return writeThroughSetter(target, prop, value, receiver, forwards, oldValue);
      }
      if (oldValue === value && Reflect.has(target, prop) || isObject3(oldValue) && isObject3(value) && deepEqual(oldValue, value))
        return descriptor === undefined || Reflect.defineProperty(target, prop, { ...descriptor, value: oldValue });
      const sameNaN = oldValue !== oldValue && value !== value && Reflect.has(target, prop);
      const truncated = prop === "length" && Number(value) < target.length ? target.slice(Number(value)) : undefined;
      const index = arrayIndex(prop);
      const grows = prop === "length" && Number(value) > Number(oldValue);
      const located = grows ? locate(node) : locate(node, prop);
      const event = located === undefined || grows ? undefined : { action: "set", path: located.paths[0], oldValue, newValue: value };
      const held = event !== undefined ? heldItems(value, oldValue) : undefined;
      const copied = copyPayload(event, located, target, held);
      if (copied === 0 /* Reaches */) {
        const after = target.slice();
        Reflect.set(after, prop, value);
        copyPayloadReaching(event, located, target, after);
      }
      const oldLength = target.length;
      const result = descriptor !== undefined ? Reflect.defineProperty(target, prop, descriptor.value === value ? descriptor : { ...descriptor, value }) : Reflect.set(target, prop, value);
      if (result) {
        if (truncated !== undefined) {
          relinkArray(node, target, target.length, truncated);
        } else if (prop !== "length") {
          const key = placeKey(prop);
          if (isObject3(oldValue))
            detachPlace(oldValue, node, key);
          if (isObject3(value))
            attachValue(value, node, key, copied === 2 /* Fresh */, located && oldValue, held);
        }
        beginWrite();
        try {
          const newLength = target.length;
          if (sameNaN) {} else if (index >= 0) {
            triggerArray(target, index, index + 1, newLength !== oldLength);
          } else if (prop === "length") {
            if (newLength !== oldLength)
              triggerArray(target, newLength, oldLength, true);
          } else {
            if (methodCache[prop] !== undefined)
              methodCache[prop] = undefined;
            trigger(target, prop);
          }
          if (grows) {
            if (located !== undefined) {
              const oldLength2 = Number(oldValue);
              const newLength2 = Number(value);
              const events = [];
              for (let i = oldLength2;i < newLength2; i++) {
                const index2 = String(i);
                for (let j = 0;j < located.paths.length; j++) {
                  events.push({ action: "set", path: [...located.paths[j], index2], newValue: undefined });
                }
              }
              if (events.length > 0)
                deliver(located.root, events);
            }
          } else if (event !== undefined) {
            dispatch(located, event);
          }
        } finally {
          try {
            if (isObject3(oldValue) && oldValue !== value) {
              evictDeep(oldValue);
            }
            if (truncated !== undefined)
              evictRemoved(truncated);
          } finally {
            endWrite();
          }
        }
      }
      return result;
    },
    deleteProperty(target, prop) {
      const oldValue = target[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
      const event = located && { action: "delete", path: located.paths[0], oldValue };
      if (copyPayload(event, located, target) === 0 /* Reaches */) {
        const after = target.slice();
        Reflect.deleteProperty(after, prop);
        copyPayloadReaching(event, located, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);
      if (hadProperty && result) {
        if (isObject3(oldValue))
          detachPlace(oldValue, node, placeKey(prop));
        beginWrite();
        try {
          const index = arrayIndex(prop);
          if (index >= 0)
            triggerArray(target, index, index + 1, false);
          else {
            if (methodCache[prop] !== undefined)
              methodCache[prop] = undefined;
            trigger(target, prop);
          }
          if (event !== undefined)
            dispatch(located, event);
        } finally {
          try {
            if (isObject3(oldValue))
              evictDeep(oldValue);
          } finally {
            endWrite();
          }
        }
      }
      return result;
    },
    defineProperty(target, prop, descriptor) {
      if ("value" in descriptor)
        return handler.set(target, prop, descriptor.value, proxy, descriptor);
      if (!("get" in descriptor) && !("set" in descriptor)) {
        const current = Reflect.getOwnPropertyDescriptor(target, prop);
        if (current !== undefined && (("value" in current) || !("writable" in descriptor)))
          return Reflect.defineProperty(target, prop, descriptor);
        return handler.set(target, prop, undefined, proxy, descriptor);
      }
      const oldLength = target.length;
      const result = Reflect.defineProperty(target, prop, descriptor);
      if (result) {
        node.dataOnly = undefined;
        beginWrite();
        try {
          const index = arrayIndex(prop);
          if (index >= 0)
            triggerArray(target, index, index + 1, target.length !== oldLength);
          else {
            if (methodCache[prop] !== undefined)
              methodCache[prop] = undefined;
            trigger(target, prop);
          }
        } finally {
          endWrite();
        }
      }
      return result;
    }
  };
  const proxy = new Proxy(arr, handler);
  globalSeen.set(arr, proxy);
  wrapperCache.set(arr, proxy);
  proxyStats.created++;
  proxyStats.arrays++;
  return proxy;
}

// src/wrap-map.ts
function isObject4(value) {
  return value !== null && typeof value === "object";
}

class MapProxyIterator {
  node;
  kind;
  target;
  trackedAt = -1;
  iterator;
  constructor(target, node, kind) {
    this.node = node;
    this.kind = kind;
    this.target = target;
    this.iterator = target.entries();
  }
  next() {
    if (this.target === undefined)
      return { value: undefined, done: true };
    if (activeEffect !== null && this.trackedAt !== trackingVersion) {
      if (this.kind === "keys")
        trackMapKeys(this.target);
      else
        trackMapValues(this.target);
      this.trackedAt = trackingVersion;
    }
    const step = this.iterator.next();
    if (step.done) {
      this.target = undefined;
      return step;
    }
    const [key, value] = step.value;
    if (this.kind === "keys")
      return { value: key, done: false };
    const wrapped = isObject4(value) ? wrapChild(value, this.node, key) : value;
    return { value: this.kind === "values" ? wrapped : [isObject4(key) ? wrapUnplaced(key) : key, wrapped], done: false };
  }
}
Object.setPrototypeOf(MapProxyIterator.prototype, Object.getPrototypeOf(Object.getPrototypeOf(new Map().entries())));
function wrapMap(map, node) {
  const cachedProxy = wrapperCache.get(map);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(map))
    return globalSeen.get(map);
  const methodCache = newMethodCache();
  let ownMembers = false;
  const watch = watchIndex(map);
  const proxy = new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */)
        return target;
      if (prop === "__v_isReactive" /* IS_REACTIVE */)
        return true;
      const cached = methodCache[prop];
      if (cached !== undefined)
        return cached;
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      if (ownMembers && hasOwn.call(target, prop))
        return collectionMember(target, prop, Reflect.get(target, prop, receiver));
      if (prop === "set") {
        methodCache[prop] = function(key, value) {
          if (value != null && typeof value === "object")
            value = unwrapForStore(value);
          const existed = target.has(key);
          const oldValue = target.get(key);
          const oldSize = target.size;
          if (oldValue === value && existed)
            return receiver;
          if (oldValue && typeof oldValue === "object" && value && typeof value === "object" && deepEqual(oldValue, value))
            return receiver;
          const located = locate(node);
          const event = located && {
            action: "map-set",
            path: located.paths[0],
            key,
            oldValue,
            newValue: value
          };
          const held = located && heldItems(value, oldValue);
          if (event !== undefined && isObject4(key))
            nameKey(event, key, target, !existed);
          const copied = copyPayload(event, located, target, held);
          if (copied === 0 /* Reaches */) {
            copyPayloadReaching(event, located, target, shallowCopy(target).set(key, value));
          }
          target.set(key, value);
          const newSize = target.size;
          if (!existed && watch.indexed)
            indexAdded(target, key);
          if (isObject4(oldValue))
            detachPlace(oldValue, node, key);
          if (isObject4(value))
            attachValue(value, node, key, copied === 2 /* Fresh */, located && oldValue, held);
          beginWrite();
          try {
            if (!existed || oldValue === oldValue || value === value)
              triggerCollection(target, key, oldSize !== newSize);
            if (event !== undefined)
              dispatch(located, event);
          } finally {
            try {
              if (isObject4(oldValue))
                evictDeep(oldValue);
            } finally {
              endWrite();
            }
          }
          return receiver;
        };
        return methodCache[prop];
      }
      if ((prop === "getOrInsert" || prop === "getOrInsertComputed") && hasOwn.call(Map.prototype, prop)) {
        methodCache[prop] = function(key, value) {
          if (prop === "getOrInsertComputed" && typeof value !== "function") {
            throw new TypeError("Map.getOrInsertComputed callback must be a function");
          }
          if (Object.is(key, -0))
            key = 0;
          if (proxy.has(key))
            return proxy.get(key);
          const inserted = prop === "getOrInsertComputed" ? value(key) : value;
          const stored = isObject4(inserted) ? unwrapForStore(inserted) : inserted;
          proxy.set(key, stored);
          if (!isObject4(stored))
            return stored;
          return target.get(key) === stored ? wrapChild(stored, node, key) : wrapUnplaced(stored);
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function(key) {
          const existed = target.has(key);
          if (!existed)
            return false;
          const oldValue = target.get(key);
          const oldSize = target.size;
          const located = locate(node);
          const event = located && {
            action: "map-delete",
            path: located.paths[0],
            key,
            oldValue
          };
          if (event !== undefined && isObject4(key))
            nameKey(event, key, target, false);
          if (copyPayload(event, located, target) === 0 /* Reaches */) {
            const after = shallowCopy(target);
            after.delete(key);
            copyPayloadReaching(event, located, target, after);
          }
          const result = target.delete(key);
          const newSize = target.size;
          if (result) {
            if (watch.indexed)
              indexRemoved(target, key);
            if (isObject4(oldValue))
              detachPlace(oldValue, node, key);
            beginWrite();
            try {
              triggerCollection(target, key, oldSize !== newSize);
              if (event !== undefined)
                dispatch(located, event);
            } finally {
              try {
                if (isObject4(oldValue))
                  evictDeep(oldValue);
              } finally {
                endWrite();
              }
            }
          }
          return result;
        };
        return methodCache[prop];
      }
      if (prop === "clear") {
        methodCache[prop] = function() {
          const oldSize = target.size;
          if (oldSize === 0)
            return;
          const located = locate(node);
          const removed = [...target];
          target.clear();
          if (watch.indexed)
            forgetReplicaIndex(target);
          for (const [key, value] of removed) {
            if (isObject4(value))
              detachPlace(value, node, key);
          }
          beginWrite();
          try {
            triggerCleared(target, removed.map(([key]) => key));
            if (located !== undefined) {
              dispatch(located, {
                action: "map-clear",
                path: located.paths[0],
                key: null
              });
            }
          } finally {
            try {
              for (const [, value] of removed) {
                if (isObject4(value))
                  evictDeep(value);
              }
            } finally {
              endWrite();
            }
          }
        };
        return methodCache[prop];
      }
      if (prop === "get") {
        methodCache[prop] = function(key) {
          trackEntry(target, key);
          const value = target.get(key);
          if (!value || typeof value !== "object")
            return value;
          return wrapChild(value, node, key);
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        methodCache[prop] = function(key) {
          trackMembership(target, key);
          return target.has(key);
        }.bind(target);
        return methodCache[prop];
      }
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const entriesIterator = proxy.entries();
            for (const [key, value] of entriesIterator) {
              callbackfn.call(thisArg, value, key, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function() {
          return new MapProxyIterator(target, node, prop);
        };
        return methodCache[prop];
      }
      if (prop === "constructor") {
        return Map;
      }
      return collectionMember(target, prop, Reflect.get(target, prop, receiver));
    },
    defineProperty(target, prop, descriptor) {
      const result = Reflect.defineProperty(target, prop, descriptor);
      if (result) {
        ownMembers = true;
        if (methodCache[prop] !== undefined)
          methodCache[prop] = undefined;
      }
      return result;
    }
  });
  globalSeen.set(map, proxy);
  wrapperCache.set(map, proxy);
  proxyStats.created++;
  proxyStats.maps++;
  return proxy;
}

// src/wrap-set.ts
function isObject5(value) {
  return value !== null && typeof value === "object";
}
var setReaders = new Set([
  "union",
  "intersection",
  "difference",
  "symmetricDifference",
  "isSubsetOf",
  "isSupersetOf",
  "isDisjointFrom"
]);

class SetProxyIterator {
  node;
  entries;
  target;
  trackedAt = -1;
  iterator;
  constructor(target, node, entries) {
    this.node = node;
    this.entries = entries;
    this.target = target;
    this.iterator = target.values();
  }
  next() {
    if (this.target === undefined)
      return { value: undefined, done: true };
    if (activeEffect !== null && this.trackedAt !== trackingVersion) {
      track(this.target, Symbol.iterator);
      this.trackedAt = trackingVersion;
    }
    const step = this.iterator.next();
    if (step.done) {
      this.target = undefined;
      return step;
    }
    if (isObject5(step.value))
      step.value = wrapChild(step.value, this.node, undefined);
    if (this.entries)
      return { value: [step.value, step.value], done: false };
    return step;
  }
}
Object.setPrototypeOf(SetProxyIterator.prototype, Object.getPrototypeOf(Object.getPrototypeOf(new Set().values())));
function wrapSet(set, node) {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(set))
    return globalSeen.get(set);
  const methodCache = newMethodCache();
  let ownMembers = false;
  const watch = watchIndex(set);
  const proxy = new Proxy(set, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */)
        return target;
      if (prop === "__v_isReactive" /* IS_REACTIVE */)
        return true;
      const cached = methodCache[prop];
      if (cached !== undefined)
        return cached;
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      if (ownMembers && hasOwn.call(target, prop))
        return collectionMember(target, prop, Reflect.get(target, prop, receiver));
      if (prop === "add") {
        methodCache[prop] = function(value2) {
          if (value2 != null && typeof value2 === "object")
            value2 = unwrapForStore(value2);
          const existed = target.has(value2);
          const oldSize = target.size;
          if (!existed) {
            const located = locate(node);
            const event = located && {
              action: "set-add",
              path: located.paths[0],
              value: value2
            };
            const copied = copyPayload(event, located, target);
            if (copied === 0 /* Reaches */) {
              copyPayloadReaching(event, located, target, shallowCopy(target).add(value2));
            }
            target.add(value2);
            const newSize = target.size;
            if (watch.indexed)
              indexAdded(target, value2);
            if (isObject5(value2))
              attachValue(value2, node, undefined, copied === 2 /* Fresh */);
            beginWrite();
            try {
              triggerCollection(target, value2, oldSize !== newSize);
              if (event !== undefined)
                dispatch(located, event);
            } finally {
              endWrite();
            }
          }
          return receiver;
        };
        return methodCache[prop];
      }
      if (prop === "delete") {
        methodCache[prop] = function(value2) {
          const existed = target.has(value2);
          const oldSize = target.size;
          if (existed) {
            const oldValue = value2;
            const located = locate(node);
            const event = located && {
              action: "set-delete",
              path: located.paths[0],
              value: value2,
              oldValue
            };
            if (copyPayload(event, located, target) === 0 /* Reaches */) {
              const after = shallowCopy(target);
              after.delete(value2);
              copyPayloadReaching(event, located, target, after);
            }
            const result = target.delete(value2);
            const newSize = target.size;
            if (result) {
              if (watch.indexed)
                indexRemoved(target, value2);
              if (isObject5(value2))
                detachPlace(value2, node, undefined);
              beginWrite();
              try {
                triggerCollection(target, value2, oldSize !== newSize);
                if (event !== undefined)
                  dispatch(located, event);
              } finally {
                try {
                  if (isObject5(value2))
                    evictDeep(value2);
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
        methodCache[prop] = function() {
          const oldSize = target.size;
          if (oldSize === 0)
            return;
          const located = locate(node);
          const removed = [...target];
          target.clear();
          if (watch.indexed)
            forgetReplicaIndex(target);
          for (const member of removed) {
            if (isObject5(member))
              detachPlace(member, node, undefined);
          }
          beginWrite();
          try {
            triggerCleared(target, removed);
            if (located !== undefined) {
              dispatch(located, {
                action: "set-clear",
                path: located.paths[0],
                value: null
              });
            }
          } finally {
            try {
              for (const member of removed) {
                if (isObject5(member))
                  evictDeep(member);
              }
            } finally {
              endWrite();
            }
          }
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        methodCache[prop] = function(value2) {
          trackEntry(target, value2);
          return target.has(value2);
        }.bind(target);
        return methodCache[prop];
      }
      if (prop === "values" || prop === Symbol.iterator || prop === "entries" || prop === "keys" || prop === "forEach") {
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const valuesIterator = proxy.values();
            for (const value2 of valuesIterator) {
              callbackfn.call(thisArg, value2, value2, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function() {
          return new SetProxyIterator(target, node, prop === "entries");
        };
        return methodCache[prop];
      }
      if (prop === "constructor") {
        return Set;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function" && setReaders.has(prop)) {
        const method = function() {
          track(target, Symbol.iterator);
          return value.apply(target, arguments);
        };
        if (hasOwn.call(Set.prototype, prop) && Set.prototype[prop] === value)
          methodCache[prop] = method;
        return method;
      }
      return collectionMember(target, prop, value);
    },
    defineProperty(target, prop, descriptor) {
      const result = Reflect.defineProperty(target, prop, descriptor);
      if (result) {
        ownMembers = true;
        if (methodCache[prop] !== undefined)
          methodCache[prop] = undefined;
      }
      return result;
    }
  });
  globalSeen.set(set, proxy);
  wrapperCache.set(set, proxy);
  proxyStats.created++;
  proxyStats.sets++;
  return proxy;
}

// src/reactive.ts
function isObject6(v) {
  return v && typeof v === "object";
}
function isReactive(value) {
  return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}
function createAsyncEmit(emit) {
  const queue2 = [];
  const generations = [];
  let flushScheduled = false;
  return (event) => {
    queue2.push(event);
    generations.push(listenerGeneration());
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => {
        let failed = false;
        let failure;
        let next = 0;
        beginAsyncDelivery();
        try {
          while (next < queue2.length) {
            try {
              const index = next++;
              emitListener(emit, queue2[index], generations[index]);
            } catch (error) {
              if (!failed && !isRefusal(error)) {
                failed = true;
                failure = error;
              }
            }
            if (next === FLUSH_CHUNK) {
              queue2.splice(0, next);
              generations.splice(0, next);
              next = 0;
            }
          }
        } finally {
          queue2.length = 0;
          generations.length = 0;
          flushScheduled = false;
          endAsyncDelivery();
        }
        if (failed)
          throw failure;
      });
    }
  };
}
function enumerableAfter(target, prop, descriptor) {
  const current = Reflect.getOwnPropertyDescriptor(target, prop);
  if (descriptor === undefined)
    return current === undefined || current.enumerable === true;
  if ("enumerable" in descriptor)
    return descriptor.enumerable === true;
  return current !== undefined && current.enumerable === true;
}
function valueOnly(descriptor) {
  return !("writable" in descriptor) && !("enumerable" in descriptor) && !("configurable" in descriptor);
}
var FLUSH_CHUNK = 1024;
function reactive(obj, emit, path = [], options) {
  if (obj["__v_skip" /* SKIP */]) {
    return obj;
  }
  const existing = globalSeen.get(obj);
  if (existing !== undefined)
    return existing;
  if (obj["__v_isReactive" /* IS_REACTIVE */])
    return obj;
  if (emit && path.length === 0 && options?.async) {
    emit = createAsyncEmit(emit);
  }
  let fresh = false;
  if (emit && path.length === 0) {
    try {
      const newValue = cloneStored(obj, undefined, 2 /* All */);
      fresh = copiedFresh;
      emitListener(emit, { action: "replace", path: [], newValue }, writeGeneration());
    } catch (error) {
      if (error instanceof SnapshotLimitError)
        throw error;
      console.error("Failed to emit initial reactive state:", error);
    }
  }
  const node = ensureLocationNode(obj);
  node.root = { emit, path, async: emit !== undefined && options?.async === true, undelivered: undefined };
  node.scope = node.root;
  if (emit && !fresh)
    adoptRoot(node);
  return createProxy(obj, node, options);
}
function wrapChild(raw, parent, key, options) {
  let node = getLocationNode(raw);
  if (node !== undefined && node.proxy !== undefined) {
    notePlace(node, parent, key);
    node.scope ??= parent.scope;
    return node.proxy;
  }
  if (raw["__v_skip" /* SKIP */])
    return raw;
  if (raw["__v_isReactive" /* IS_REACTIVE */])
    return wrapChild(toRaw(raw), parent, key, options);
  if (raw instanceof Date)
    return new Date(raw.getTime());
  node ??= ensureLocationNode(raw);
  notePlace(node, parent, key);
  node.scope ??= parent.scope;
  return restoreEvicted(node) ?? createProxy(raw, node, options);
}
function wrapUnplaced(raw) {
  if (raw["__v_skip" /* SKIP */])
    return raw;
  const existing = globalSeen.get(raw);
  if (existing !== undefined)
    return existing;
  if (raw["__v_isReactive" /* IS_REACTIVE */])
    return wrapUnplaced(toRaw(raw));
  const node = ensureLocationNode(raw);
  return restoreEvicted(node) ?? createProxy(raw, node);
}
function createProxy(raw, node, options) {
  const proxy = Array.isArray(raw) ? wrapArray(raw, node) : raw instanceof Map ? wrapMap(raw, node) : raw instanceof Set ? wrapSet(raw, node) : wrapObject(raw, node, options);
  node.proxy = proxy;
  return proxy;
}
function wrapObject(obj, node, options) {
  let forwarders;
  let landing;
  let landingProp;
  let defining;
  function writeThrough(target, prop, value, receiver) {
    const previous = landing;
    const previousProp = landingProp;
    landing = receiver;
    landingProp = prop;
    try {
      return Reflect.set(target, prop, value, receiver);
    } finally {
      landing = previous;
      landingProp = previousProp;
    }
  }
  const handler = {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */) {
        return target;
      }
      if (prop === "__v_isReactive" /* IS_REACTIVE */) {
        return true;
      }
      const value = Reflect.get(target, prop, receiver);
      track(target, prop);
      if (!isObject6(value))
        return value;
      return wrapChild(value, node, prop, options);
    },
    set(target, prop, value, receiver) {
      const descriptor = defining;
      if (descriptor !== undefined)
        defining = undefined;
      const had = hasOwn.call(target, prop);
      const setter = had && node.dataOnly === true ? undefined : setterOf(target, prop, had, node);
      if (receiver !== proxy && setter === undefined && !(had && forwarders?.get(receiver)?.has(prop) === true))
        return writeThrough(target, prop, value, receiver);
      if (isObject6(value))
        value = unwrapForStore(value);
      const oldValue = target[prop];
      if (setter !== undefined && descriptor === undefined) {
        const forwards = receiver === proxy || forwardsTo(receiver, target);
        if (forwards && setter.get !== undefined && (oldValue === value || !options?.async && isObject6(oldValue) && isObject6(value) && deepEqual(oldValue, value)))
          return true;
        return writeThroughSetter(target, prop, value, receiver, forwards, oldValue);
      }
      if (had && (oldValue === value || !options?.async && isObject6(oldValue) && isObject6(value) && deepEqual(oldValue, value)))
        return descriptor === undefined || Reflect.defineProperty(target, prop, { ...descriptor, value: oldValue });
      const located = locate(node, prop);
      const event = located && {
        action: "set",
        path: located.paths[0],
        oldValue,
        newValue: value
      };
      const held = located && heldItems(value, oldValue);
      const copied = copyPayload(event, located, target, held);
      if (copied === 0 /* Reaches */) {
        const after = shallowCopy(target);
        if (enumerableAfter(target, prop, descriptor))
          setData(after, prop, value);
        copyPayloadReaching(event, located, target, after);
      }
      const result = descriptor === undefined ? Reflect.set(target, prop, value) : had && node.dataOnly === true && valueOnly(descriptor) && Reflect.set(target, prop, value) || Reflect.defineProperty(target, prop, descriptor.value === value ? descriptor : { ...descriptor, value });
      if (result) {
        if (isObject6(oldValue))
          detachPlace(oldValue, node, prop);
        if (isObject6(value))
          attachValue(value, node, prop, copied === 2 /* Fresh */, located && oldValue, held);
        beginWrite();
        try {
          if (!had && hasOwn.call(target, prop))
            triggerKeyChange(target);
          else if (oldValue === oldValue || value === value)
            trigger(target, prop);
          if (event !== undefined)
            dispatch(located, event);
        } finally {
          try {
            if (isObject6(oldValue)) {
              evictDeep(oldValue);
            }
          } finally {
            endWrite();
          }
        }
      }
      return result;
    },
    deleteProperty(target, prop) {
      const oldValue = target[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const located = hadProperty ? locate(node, prop) : undefined;
      const event = located && {
        action: "delete",
        path: located.paths[0],
        oldValue
      };
      if (copyPayload(event, located, target) === 0 /* Reaches */) {
        const after = shallowCopy(target);
        delete after[prop];
        copyPayloadReaching(event, located, target, after);
      }
      const result = Reflect.deleteProperty(target, prop);
      if (hadProperty && result) {
        if (isObject6(oldValue))
          detachPlace(oldValue, node, prop);
        beginWrite();
        try {
          triggerKeyChange(target);
          if (event !== undefined)
            dispatch(located, event);
        } finally {
          try {
            if (isObject6(oldValue)) {
              evictDeep(oldValue);
            }
          } finally {
            endWrite();
          }
        }
      }
      return result;
    },
    defineProperty(target, prop, descriptor) {
      if ("value" in descriptor) {
        if (landing !== undefined) {
          if (landingProp === prop && valueOnly(descriptor) && hasOwn.call(target, prop)) {
            forwarders ??= new WeakMap;
            let keys = forwarders.get(landing);
            if (keys === undefined)
              forwarders.set(landing, keys = new Set);
            keys.add(prop);
          }
          landing = undefined;
        }
        defining = descriptor;
        return handler.set(target, prop, descriptor.value, proxy);
      }
      if (!("get" in descriptor) && !("set" in descriptor)) {
        const current = Reflect.getOwnPropertyDescriptor(target, prop);
        if (current !== undefined && (("value" in current) || !("writable" in descriptor)))
          return Reflect.defineProperty(target, prop, descriptor);
        defining = descriptor;
        return handler.set(target, prop, undefined, proxy);
      }
      const had = hasOwn.call(target, prop);
      const result = Reflect.defineProperty(target, prop, descriptor);
      if (result) {
        node.dataOnly = undefined;
        beginWrite();
        try {
          if (!had)
            triggerKeyChange(target);
          else
            trigger(target, prop);
        } finally {
          endWrite();
        }
      }
      return result;
    }
  };
  const proxy = new Proxy(obj, handler);
  globalSeen.set(obj, proxy);
  proxyStats.created++;
  proxyStats.objects++;
  return proxy;
}

// src/state.ts
function getValue(obj, key) {
  if (obj instanceof Map)
    return obj.get(key);
  return obj[key];
}
function setValue(obj, key, value) {
  if (obj instanceof Map)
    obj.set(key, value);
  else
    obj[key] = value;
}
function deleteValue(obj, key) {
  if (obj instanceof Map)
    obj.delete(key);
  else
    delete obj[key];
}
function validateCachedPath(root, fullPath, pathKey, cached) {
  if (fullPath.length === 0)
    return cached;
  const lastKey = fullPath[fullPath.length - 1];
  let grandparent = root;
  for (let i = 0;i < fullPath.length - 1; i++) {
    grandparent = grandparent ? getValue(grandparent, fullPath[i]) : undefined;
    if (grandparent === undefined)
      break;
  }
  if (grandparent === undefined) {
    evictDescendantsFromPathCache(root, pathKey);
    return;
  }
  const actual = getValue(grandparent, lastKey);
  if (actual === cached)
    return cached;
  evictDescendantsFromPathCache(root, pathKey);
  return;
}
var actionHandlers = {
  set: function(parent, key, event) {
    if (Array.isArray(parent) && key === "length" && Number(event.newValue) > parent.length) {
      console.warn(`refusing to grow array length via bare set at path ${event.path.join(".")}`);
      return;
    }
    setValue(parent, key, event.newValue);
  },
  delete: function(parent, key) {
    deleteValue(parent, key);
  },
  "array-push": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (!event.items) {
      console.warn("array-push event missing items");
      return;
    }
    targetArray.push(...event.items);
  },
  "array-pop": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (targetArray.length > 0) {
      targetArray.pop();
    }
  },
  "array-splice": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (event.key === undefined || event.deleteCount === undefined) {
      console.warn("array-splice event missing key or deletecount");
      return;
    }
    if (event.items && event.items.length > 0) {
      targetArray.splice(event.key, event.deleteCount, ...event.items);
    } else {
      targetArray.splice(event.key, event.deleteCount);
    }
  },
  "array-shift": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (targetArray.length > 0) {
      targetArray.shift();
    }
  },
  "array-unshift": function(targetArray, _keyIgnored, event) {
    if (!Array.isArray(targetArray)) {
      console.warn(`expected array at path ${event.path.join(".")}`);
      return;
    }
    if (!event.items) {
      console.warn("array-unshift event missing items");
      return;
    }
    targetArray.unshift(...event.items);
  },
  "map-set": function(targetMap2, _parentKeyIgnored, event) {
    if (!(targetMap2 instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    replicaMapSet(targetMap2, event.key, event.newValue);
  },
  "map-delete": function(targetMap2, _parentKeyIgnored, event) {
    if (!(targetMap2 instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    replicaMapDelete(targetMap2, event.key);
  },
  "map-clear": function(targetMap2, _parentKeyIgnored, event) {
    if (!(targetMap2 instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap2.clear();
    forgetReplicaIndex(targetMap2);
  },
  "set-add": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    replicaAdd(targetSet, event.value);
  },
  "set-delete": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    replicaDelete(targetSet, event.value);
  },
  "set-clear": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.clear();
    forgetReplicaIndex(targetSet);
  },
  replace: function(target, _keyIgnored, event) {
    const newValue = event.newValue;
    if (newValue === undefined || newValue === null) {
      console.warn("replace action requires newValue");
      return;
    }
    if (Array.isArray(target) && Array.isArray(newValue)) {
      target.splice(0, target.length, ...newValue);
    } else if (target instanceof Map && newValue instanceof Map) {
      const newValueEntries = [...newValue.entries()];
      target.clear();
      forgetReplicaIndex(target);
      const reactiveTarget = isReactive(target);
      for (const [key, value] of newValueEntries) {
        if (reactiveTarget)
          replicaMapSet(target, key, value);
        else
          target.set(key, value);
      }
    } else if (target instanceof Set && newValue instanceof Set) {
      const newValueEntries = [...newValue.values()];
      target.clear();
      forgetReplicaIndex(target);
      const reactiveTarget = isReactive(target);
      for (const value of newValueEntries) {
        if (reactiveTarget)
          replicaAdd(target, value);
        else
          target.add(value);
      }
    } else if (typeof target === "object" && target !== null && typeof newValue === "object" && newValue !== null) {
      Object.keys(target).forEach((key) => delete target[key]);
      Object.assign(target, newValue);
    } else {
      console.warn(`Type mismatch or unsupported type for 'replace' action at path ${event.path.join(".")}. Target type: ${typeof target} ${target.constructor.name}, New value type: ${typeof newValue} ${newValue.constructor.name}`);
    }
  }
};
function updateState(root, event) {
  const { action, path } = event;
  if (!path || path.length === 0 && action !== "replace") {
    console.warn("event path is invalid for action", event);
    return;
  }
  const handler = actionHandlers[action];
  if (!handler) {
    console.error(`unhandled action type: ${action}`, event);
    return;
  }
  let targetForHandler;
  let keyForHandler = null;
  if (action === "set" || action === "delete") {
    if (path.length === 1) {
      targetForHandler = root;
      keyForHandler = path[0];
    } else {
      const parentPath = path.slice(0, -1);
      const parentPathKey = parentPath.join(".");
      let parent = pathCache.get(root)?.get(parentPathKey);
      if (parent !== undefined) {
        parent = validateCachedPath(root, parentPath, parentPathKey, parent);
      }
      if (parent === undefined) {
        parent = parentPath.reduce((acc, key) => acc ? getValue(acc, key) : undefined, root);
        if (parent !== undefined)
          setInPathCache(root, parentPathKey, parent);
      }
      if (parent === undefined) {
        console.warn(`parent path ${parentPathKey} not found for action ${action}`);
        return;
      }
      targetForHandler = parent;
      keyForHandler = path[path.length - 1];
    }
  } else if (action.startsWith("array-") || action.startsWith("map-") || action.startsWith("set-") || action === "replace") {
    if (path.length === 0 && action === "replace") {
      targetForHandler = root;
    } else {
      const targetPath = path;
      const targetPathKey = targetPath.join(".");
      let targetCollection = pathCache.get(root)?.get(targetPathKey);
      if (targetCollection !== undefined) {
        targetCollection = validateCachedPath(root, targetPath, targetPathKey, targetCollection);
      }
      if (targetCollection === undefined) {
        targetCollection = targetPath.reduce((acc, key) => acc ? getValue(acc, key) : undefined, root);
        if (targetCollection !== undefined)
          setInPathCache(root, targetPathKey, targetCollection);
      }
      if (targetCollection === undefined) {
        console.warn(`target at path ${targetPathKey} not found for action ${action}`);
        return;
      }
      targetForHandler = targetCollection;
    }
  } else {
    console.error(`unexpected action type passed checks: ${action}`);
    return;
  }
  handler(targetForHandler, keyForHandler, event);
  if (action === "set" && event.newValue != null && typeof event.newValue === "object") {
    const fullPathKey = path.join(".");
    evictDescendantsFromPathCache(root, fullPathKey);
  }
}
// src/ref.ts
var isRefSymbol = Symbol("isRef");
function ref(value) {
  return createRef(value);
}
function createRef(rawValue) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  let _value = rawValue;
  const r = {
    [isRefSymbol]: true,
    get value() {
      track(r, "value");
      return _value;
    },
    set value(newValue) {
      if (_value !== newValue) {
        _value = newValue;
        trigger(r, "value");
      }
    }
  };
  return r;
}
function isRef(r) {
  return !!(r && r[isRefSymbol]);
}
function unref(refValue) {
  return isRef(refValue) ? refValue.value : refValue;
}
function toRefs(object) {
  const result = {};
  for (const key in object) {
    result[key] = toRef(object, key);
  }
  return result;
}
function toRef(object, key) {
  return {
    [isRefSymbol]: true,
    get value() {
      track(this, "value");
      return object[key];
    },
    set value(newVal) {
      object[key] = newVal;
    }
  };
}
function triggerRef(ref2) {
  trigger(ref2, "value");
}

// src/computed.ts
var isComputedSymbol = Symbol("isComputed");
function computed(getterOrOptions) {
  let getter;
  let setter;
  const isGetter = typeof getterOrOptions === "function";
  if (isGetter) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  let _value;
  let _dirty = true;
  let computedRef;
  const stopHandle = watchEffect(getter, { lazy: true });
  const effectRunner = stopHandle.effect;
  effectRunner.invalidate = () => {
    if (!_dirty) {
      _dirty = true;
      trigger(computedRef, "value");
    }
  };
  computedRef = {
    [isRefSymbol]: true,
    [isComputedSymbol]: true,
    get value() {
      track(computedRef, "value");
      if (_dirty) {
        _dirty = false;
        try {
          _value = effectRunner.run();
        } catch (error) {
          _dirty = true;
          throw error;
        }
      }
      return _value;
    },
    set value(newValue) {
      if (setter) {
        setter(newValue);
      } else {
        console.warn("computed value is read-only");
      }
    },
    stop: stopHandle
  };
  return computedRef;
}
function isComputed(c) {
  return !!(c && c[isComputedSymbol]);
}

// src/watch.ts
function traverse(value, seen = new Set) {
  if (value === null || typeof value !== "object" || seen.has(value))
    return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0;i < value.length; i++)
      traverse(value[i], seen);
  } else if (value instanceof Map) {
    value.forEach((item, key) => {
      traverse(key, seen);
      traverse(item, seen);
    });
  } else if (value instanceof Set) {
    value.forEach((item) => traverse(item, seen));
  } else {
    const raw = toRaw(value);
    if (raw !== value)
      trackKeys(raw);
    for (const key in value)
      traverse(value[key], seen);
  }
  return value;
}
function watch(source, callback, options = {}) {
  const { immediate = false, deep = true } = options;
  const isMultiSource = Array.isArray(source);
  const getter = () => {
    if (isMultiSource) {
      return source.map((s) => {
        if (isRef(s))
          return s.value;
        if (isComputed(s))
          return s.value;
        if (typeof s === "function")
          return s();
        return s;
      });
    }
    if (isRef(source))
      return source.value;
    if (isComputed(source))
      return source.value;
    if (typeof source === "function")
      return source();
    return source;
  };
  let oldValue;
  let initialized = false;
  const stopEffect = watchEffect(() => {
    let currentValue = getter();
    if (deep) {
      traverse(currentValue);
    }
    const job = () => {
      if (initialized) {
        let hasChanged = false;
        if (isMultiSource) {
          if (!Array.isArray(oldValue) || currentValue.length !== oldValue.length) {
            hasChanged = true;
          } else {
            hasChanged = currentValue.some((val, i) => {
              return deep ? !deepEqual(val, oldValue[i]) : val !== oldValue[i];
            });
          }
        } else {
          hasChanged = deep ? !deepEqual(currentValue, oldValue) : currentValue !== oldValue;
        }
        if (hasChanged) {
          const prevOldValue = oldValue;
          if (isMultiSource) {
            currentValue = getter();
          }
          const valueToClone = currentValue && typeof currentValue === "object" && currentValue.__v_raw ? currentValue.__v_raw : currentValue;
          oldValue = deep ? deepClone(valueToClone) : currentValue;
          callback(currentValue, prevOldValue);
        }
      } else {
        const valueToClone = currentValue && typeof currentValue === "object" && currentValue.__v_raw ? currentValue.__v_raw : currentValue;
        oldValue = deep ? deepClone(valueToClone) : currentValue;
        initialized = true;
        if (immediate) {
          callback(currentValue, undefined);
        }
      }
    };
    job();
  });
  return stopEffect;
}
// src/mark-raw.ts
function markRaw(obj) {
  if (obj && typeof obj === "object") {
    Object.defineProperty(obj, "__v_skip" /* SKIP */, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  return obj;
}
// src/integrations/vue3.ts
var import_reactivity = require("@vue/reactivity");
function trackVueReactiveEvents(vueState, emit, options = {}) {
  const { emitInitialReplace = true, onDiffError } = options;
  assertSameVueCopy(vueState);
  if (emitInitialReplace) {
    try {
      emit({ action: "replace", path: [], newValue: deepClone(vueState) });
    } catch (e) {}
  }
  const tracker = new Tracker(emit, onDiffError);
  const root = createNode(tracker, null, null, vueState).start();
  function warnStopped(method) {
    console.warn(`[reactive-proxy-state] trackVueReactiveEvents: ${method}() after stop() does nothing. stop() is final; create a new tracker to track again.`);
  }
  return {
    stop() {
      if (tracker.stopped)
        return;
      tracker.stopped = true;
      tracker.emitting = false;
      root.dispose();
      tracker.scope.stop();
    },
    pause() {
      if (tracker.stopped)
        warnStopped("pause");
      else
        tracker.emitting = false;
    },
    resume() {
      if (tracker.stopped)
        warnStopped("resume");
      else
        tracker.emitting = true;
    }
  };
}
function assertSameVueCopy(state) {
  if (import_reactivity.isProxy(state)) {
    if (import_reactivity.isReadonly(state))
      return;
    const raw = import_reactivity.toRaw(state);
    if ((import_reactivity.isShallow(state) ? import_reactivity.shallowReactive(raw) : import_reactivity.reactive(raw)) === state)
      return;
  }
  throw new TypeError("trackVueReactiveEvents: the state is not a reactive() object of the @vue/reactivity copy this library imports. " + "Pass the object Vue's reactive() returned. If it is one, the app loads two copies of @vue/reactivity: " + "dedupe 'vue' and '@vue/reactivity' in the bundler.");
}
var hasOwn2 = Object.prototype.hasOwnProperty;
var NO_CHILDREN = new Map;

class Tracker {
  listener;
  onDiffError;
  scope = import_reactivity.effectScope(true);
  emitting = true;
  stopped = false;
  scans = 0;
  constructor(listener, onDiffError) {
    this.listener = listener;
    this.onDiffError = onDiffError;
  }
  emit(event) {
    import_reactivity.pauseTracking();
    try {
      this.listener(event);
    } catch (error) {
      this.report(event.path, error);
    } finally {
      import_reactivity.resetTracking();
    }
  }
  report(path, error) {
    if (this.onDiffError === undefined)
      return;
    import_reactivity.pauseTracking();
    try {
      this.onDiffError({ key: path.length > 0 ? String(path[0]) : "", path, error });
    } finally {
      import_reactivity.resetTracking();
    }
  }
}
function scanNode() {
  this.scan();
}
function rerunNode() {
  if (this.disposed)
    return;
  this.run();
  if (!this.disposed && this.dirty)
    this.run();
}
function createNode(tracker, parent, key, proxy) {
  const node = tracker.scope.run(() => new TrackedNode(tracker, parent, key, proxy));
  const effects = tracker.scope.effects;
  if (effects[effects.length - 1] === node)
    effects.pop();
  return node;
}

class TrackedNode extends import_reactivity.ReactiveEffect {
  tracker;
  parent;
  key;
  proxy;
  raw;
  kind;
  shadow;
  children;
  pending;
  rawIndex;
  claim;
  started;
  disposed;
  constructor(tracker, parent, key, proxy) {
    super(scanNode);
    this.scheduler = rerunNode;
    this.tracker = tracker;
    this.parent = parent;
    this.key = key;
    this.proxy = proxy;
    this.raw = import_reactivity.toRaw(proxy);
    this.kind = nodeKind(this.raw);
    this.shadow = undefined;
    this.children = NO_CHILDREN;
    this.pending = null;
    this.rawIndex = null;
    this.claim = 0;
    this.started = false;
    this.disposed = false;
  }
  start() {
    this.run();
    this.started = true;
    return this;
  }
  path() {
    const path = [];
    for (let node = this;node.parent !== null; node = node.parent)
      path.push(node.key);
    return path.reverse();
  }
  dispose() {
    if (this.disposed)
      return;
    this.disposed = true;
    this.stop();
    for (const child of this.children.values())
      child.dispose();
    this.children = NO_CHILDREN;
    this.shadow = undefined;
  }
  attachShadow() {
    const parent = this.parent;
    if (this.disposed || parent === null || parent.shadow === undefined)
      return;
    parent.shadow[this.key] = this.shadow;
  }
  scan() {
    try {
      if (this.shadow === undefined) {
        this.firstScan();
        if (this.started)
          this.attachShadow();
      } else if (this.kind === "map" || this.kind === "set") {
        this.scanCollection();
      } else {
        this.scanEntries();
      }
    } catch (error) {
      this.fail(error);
    }
  }
  firstScan() {
    const proxy = this.proxy;
    if (this.kind === "map" || this.kind === "set") {
      this.shadow = deepClone(proxy);
      return;
    }
    if (this.kind === "array") {
      const length = proxy.length;
      const shadow2 = new Array(length);
      this.shadow = shadow2;
      for (let index = 0;index < length; index++)
        shadow2[index] = this.adopt(index, proxy[index]);
      return;
    }
    const keys = Object.keys(proxy);
    const shadow = {};
    this.shadow = shadow;
    for (let index = 0;index < keys.length; index++) {
      const key = keys[index];
      shadow[key] = this.adopt(key, proxy[key]);
    }
  }
  adopt(key, value) {
    if (!isNodeValue(value))
      return copyValue(value);
    const child = this.createChild(key, value);
    if (this.children === NO_CHILDREN)
      this.children = new Map;
    this.children.set(key, child);
    return child.shadow;
  }
  createChild(key, value) {
    const raw = import_reactivity.toRaw(value);
    for (let node = this;node !== null; node = node.parent) {
      if (node.raw === raw) {
        throw new Error(`trackVueReactiveEvents: the state holds a cycle at ${[...this.path(), key].join(".")}`);
      }
    }
    return createNode(this.tracker, this, key, value).start();
  }
  scanCollection() {
    const current = deepClone(this.proxy);
    if (this.tracker.emitting)
      diffCollection(current, this.shadow, this.path(), this.tracker);
    if (this.disposed)
      return;
    this.shadow = current;
    this.attachShadow();
  }
  scanEntries() {
    const proxy = this.proxy;
    const isArray = this.kind === "array";
    const keys = isArray ? null : Object.keys(proxy);
    const length = isArray ? proxy.length : keys.length;
    const values = new Array(length);
    if (isArray)
      for (let index = 0;index < length; index++)
        values[index] = proxy[index];
    else
      for (let index = 0;index < length; index++)
        values[index] = proxy[keys[index]];
    const scanId = ++this.tracker.scans;
    const oldChildren = this.children;
    let children = null;
    let nodes2 = null;
    for (let index = 0;index < length; index++) {
      const value = values[index];
      if (!isNodeValue(value))
        continue;
      const key = isArray ? index : keys[index];
      const child = this.resolveChild(key, value, oldChildren, scanId);
      if (children === null) {
        children = new Map;
        this.pending = children;
        nodes2 = new Array(length);
      }
      children.set(key, child);
      nodes2[index] = child;
    }
    this.rawIndex = null;
    for (const child of oldChildren.values())
      if (child.claim !== scanId)
        child.dispose();
    if (isArray)
      this.diffArray(values, nodes2, oldChildren);
    else
      this.diffObject(keys, values, nodes2, oldChildren, scanId);
    this.pending = null;
    if (this.disposed) {
      if (children !== null)
        for (const child of children.values())
          child.dispose();
      return;
    }
    this.children = children ?? NO_CHILDREN;
  }
  resolveChild(key, value, oldChildren, scanId) {
    const raw = import_reactivity.toRaw(value);
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
          if (candidate.claim === scanId)
            continue;
          candidate.claim = scanId;
          candidate.key = key;
          return candidate;
        }
      }
    }
    return this.createChild(key, value);
  }
  diffArray(values, nodes2, oldChildren) {
    const tracker = this.tracker;
    const shadow = this.shadow;
    const emitting = tracker.emitting;
    const path = emitting ? this.path() : null;
    const length = values.length;
    const oldLength = shadow.length;
    for (let index = 0;index < length; index++) {
      const child = nodes2 === null ? undefined : nodes2[index];
      const existed = index < oldLength;
      const before = shadow[index];
      const after = child !== undefined ? child.shadow : copyValue(values[index]);
      if (emitting && !(existed && (child !== undefined ? oldChildren.get(index) === child : before === after))) {
        path.push(index);
        if (existed)
          diffPlain(after, before, path, tracker);
        else
          tracker.emit({ action: "set", path: path.slice(), newValue: copyValue(after) });
        path.pop();
      }
      shadow[index] = after;
    }
    if (length < oldLength) {
      if (emitting) {
        path.push("length");
        tracker.emit({ action: "set", path: path.slice(), newValue: length, oldValue: oldLength });
        path.pop();
      }
      shadow.length = length;
    }
  }
  diffObject(keys, values, nodes2, oldChildren, scanId) {
    const tracker = this.tracker;
    const raw = this.raw;
    const shadow = this.shadow;
    const emitting = tracker.emitting;
    const path = emitting ? this.path() : null;
    for (const key of Object.keys(shadow)) {
      if (hasOwn2.call(raw, key))
        continue;
      if (emitting) {
        const gone = oldChildren.get(key);
        const oldValue = gone !== undefined && gone.claim !== scanId ? shadow[key] : copyValue(shadow[key]);
        path.push(key);
        tracker.emit({ action: "delete", path: path.slice(), oldValue });
        path.pop();
      }
      delete shadow[key];
    }
    for (let index = 0;index < keys.length; index++) {
      const key = keys[index];
      const child = nodes2 === null ? undefined : nodes2[index];
      const existed = hasOwn2.call(shadow, key);
      const before = shadow[key];
      const after = child !== undefined ? child.shadow : copyValue(values[index]);
      if (emitting && !(existed && (child !== undefined ? oldChildren.get(key) === child : before === after))) {
        path.push(key);
        if (existed)
          diffPlain(after, before, path, tracker);
        else
          tracker.emit({ action: "set", path: path.slice(), newValue: copyValue(after) });
        path.pop();
      }
      shadow[key] = after;
    }
  }
  fail(error) {
    this.discardChildren();
    if (this.disposed)
      return;
    const path = this.path();
    this.shadow = undefined;
    try {
      this.firstScan();
    } catch {
      this.discardChildren();
      this.shadow = undefined;
    }
    if (this.started)
      this.attachShadow();
    this.tracker.report(path, error);
  }
  discardChildren() {
    for (const child of this.children.values())
      child.dispose();
    if (this.pending !== null)
      for (const child of this.pending.values())
        child.dispose();
    this.children = NO_CHILDREN;
    this.pending = null;
    this.rawIndex = null;
  }
}
function nodeKind(raw) {
  if (Array.isArray(raw))
    return "array";
  if (raw instanceof Map)
    return "map";
  if (raw instanceof Set)
    return "set";
  return "object";
}
function isNodeValue(value) {
  return value !== null && typeof value === "object" && import_reactivity.isReactive(value);
}
function indexByRaw(children) {
  const byRaw = new Map;
  for (const child of children.values()) {
    const list = byRaw.get(child.raw);
    if (list)
      list.push(child);
    else
      byRaw.set(child.raw, [child]);
  }
  return byRaw;
}
function typeTag(v) {
  if (v === null || typeof v !== "object")
    return "primitive";
  if (Array.isArray(v))
    return "array";
  if (v instanceof Map)
    return "map";
  if (v instanceof Set)
    return "set";
  if (v instanceof Date)
    return "date";
  return "object";
}
function copyValue(value) {
  if (value === null || typeof value !== "object")
    return value;
  const raw = import_reactivity.toRaw(value);
  if (raw instanceof Date)
    return new Date(raw.getTime());
  if (Array.isArray(raw)) {
    const length = raw.length;
    const copy2 = new Array(length);
    for (let index = 0;index < length; index++)
      copy2[index] = copyValue(raw[index]);
    return copy2;
  }
  if (raw instanceof Map) {
    const copy2 = new Map;
    raw.forEach((entry, key) => copy2.set(copyValue(key), copyValue(entry)));
    return copy2;
  }
  if (raw instanceof Set) {
    const copy2 = new Set;
    raw.forEach((entry) => copy2.add(copyValue(entry)));
    return copy2;
  }
  const copy = {};
  const keys = Object.keys(raw);
  for (let index = 0;index < keys.length; index++)
    copy[keys[index]] = copyValue(raw[keys[index]]);
  return copy;
}
function diffPlain(curr, old, path, tracker) {
  if (curr === null || typeof curr !== "object") {
    if (curr !== old && !(curr !== curr && old !== old)) {
      tracker.emit({ action: "set", path: path.slice(), oldValue: copyValue(old), newValue: curr });
    }
    return;
  }
  const tag = typeTag(curr);
  if (tag !== typeTag(old)) {
    tracker.emit({ action: "set", path: path.slice(), oldValue: copyValue(old), newValue: copyValue(curr) });
    return;
  }
  if (tag === "date") {
    if (+curr !== +old) {
      tracker.emit({ action: "set", path: path.slice(), oldValue: copyValue(old), newValue: new Date(+curr) });
    }
    return;
  }
  if (tag === "array") {
    const min = Math.min(curr.length, old.length);
    for (let i = 0;i < min; i++) {
      path.push(i);
      diffPlain(curr[i], old[i], path, tracker);
      path.pop();
    }
    if (curr.length > old.length) {
      for (let i = old.length;i < curr.length; i++) {
        path.push(i);
        tracker.emit({ action: "set", path: path.slice(), newValue: copyValue(curr[i]) });
        path.pop();
      }
    } else if (curr.length < old.length) {
      path.push("length");
      tracker.emit({ action: "set", path: path.slice(), newValue: curr.length, oldValue: old.length });
      path.pop();
    }
    return;
  }
  if (tag === "map" || tag === "set") {
    diffCollection(curr, old, path.slice(), tracker);
    return;
  }
  for (const k of Object.keys(old)) {
    if (!hasOwn2.call(curr, k)) {
      path.push(k);
      tracker.emit({ action: "delete", path: path.slice(), oldValue: copyValue(old[k]) });
      path.pop();
    }
  }
  for (const k of Object.keys(curr)) {
    path.push(k);
    if (!hasOwn2.call(old, k))
      tracker.emit({ action: "set", path: path.slice(), newValue: copyValue(curr[k]) });
    else
      diffPlain(curr[k], old[k], path, tracker);
    path.pop();
  }
}
function sameValue(a, b, seen) {
  if (a === b || a !== a && b !== b)
    return true;
  const tag = typeTag(a);
  if (tag === "primitive" || tag !== typeTag(b))
    return false;
  if (tag === "date")
    return sameValue(+a, +b, seen);
  seen ??= new WeakMap;
  if (seen.get(a) === b)
    return true;
  seen.set(a, b);
  if (tag === "array") {
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++)
      if (!sameValue(a[i], b[i], seen))
        return false;
    return true;
  }
  if (tag === "map") {
    if (a.size !== b.size)
      return false;
    for (const [k, v] of a)
      if (!b.has(k) || !sameValue(v, b.get(k), seen))
        return false;
    return true;
  }
  if (tag === "set") {
    if (a.size !== b.size)
      return false;
    for (const v of a)
      if (!b.has(v))
        return false;
    return true;
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length)
    return false;
  for (const k of keys)
    if (!hasOwn2.call(b, k) || !sameValue(a[k], b[k], seen))
      return false;
  return true;
}
function diffCollection(curr, old, path, tracker) {
  if (curr instanceof Map) {
    const before = old;
    for (const [k, v] of before) {
      if (!curr.has(k))
        tracker.emit({ action: "map-delete", path: path.slice(), key: k, oldValue: v });
    }
    for (const [k, v] of curr) {
      if (!before.has(k)) {
        tracker.emit({ action: "map-set", path: path.slice(), key: k, newValue: v });
      } else if (!sameValue(v, before.get(k), undefined)) {
        tracker.emit({ action: "map-set", path: path.slice(), key: k, newValue: v, oldValue: before.get(k) });
      }
    }
    return;
  }
  for (const v of old) {
    if (!curr.has(v))
      tracker.emit({ action: "set-delete", path: path.slice(), value: v, oldValue: v });
  }
  for (const v of curr) {
    if (!old.has(v))
      tracker.emit({ action: "set-add", path: path.slice(), value: v });
  }
}
// src/integrations/electron-bridge.ts
function makeTx() {
  try {
    const g = globalThis;
    if (g.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function createBridgeEmitter(opts) {
  const { id, apply, send, onMessage, forward, seenLimit = 1000 } = opts;
  let muteCount = 0;
  const mute = (fn) => {
    muteCount++;
    try {
      return fn();
    } finally {
      muteCount--;
    }
  };
  const seen = new Set;
  const order = [];
  const markSeen = (tx) => {
    if (seen.has(tx))
      return;
    seen.add(tx);
    order.push(tx);
    if (order.length > seenLimit) {
      const oldest = order.shift();
      seen.delete(oldest);
    }
  };
  const emit = (event) => {
    if (muteCount > 0)
      return;
    const msg = { tx: makeTx(), origin: id, event };
    markSeen(msg.tx);
    send(msg);
  };
  const unsubscribe = onMessage((msg, ctx) => {
    if (!msg || !msg.tx)
      return;
    if (seen.has(msg.tx))
      return;
    markSeen(msg.tx);
    if (msg.origin === id)
      return;
    mute(() => apply(msg.event));
    if (forward)
      forward(msg, ctx);
  });
  const stop = () => unsubscribe();
  return { emit, stop, mute };
}
function createRendererBridgeEmitter(opts) {
  const { id, channel, ipcRenderer, apply, seenLimit } = opts;
  return createBridgeEmitter({
    id,
    apply,
    seenLimit,
    send: (msg) => ipcRenderer.send(channel, msg),
    onMessage: (cb) => {
      const handler = (_e, msg) => cb(msg);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.off(channel, handler);
    }
  });
}
function createMainBridgeEmitter(opts) {
  const { id = "main", channel, ipcMain, windows, apply, seenLimit } = opts;
  const broadcast = (msg, exceptId) => {
    for (const w of windows()) {
      if (exceptId != null && w.webContents.id === exceptId)
        continue;
      w.webContents.send(channel, msg);
    }
  };
  return createBridgeEmitter({
    id,
    apply,
    seenLimit,
    send: (msg) => broadcast(msg),
    onMessage: (cb) => {
      const handler = (e, msg) => cb(msg, { senderId: e?.sender?.id });
      ipcMain.on(channel, handler);
      return () => ipcMain.off(channel, handler);
    },
    forward: (msg, ctx) => broadcast(msg, ctx?.senderId)
  });
}
// src/deep-to-raw.ts
function deepToRaw(input, seen = new WeakMap) {
  if (input === null || typeof input !== "object") {
    return input;
  }
  if (isRef(input)) {
    return deepToRaw(input.value, seen);
  }
  if (seen.has(input)) {
    return seen.get(input);
  }
  if (Array.isArray(input)) {
    const source2 = toRaw(input);
    const result = [];
    seen.set(input, result);
    seen.set(source2, result);
    for (let i = 0;i < source2.length; i++) {
      result.push(deepToRaw(source2[i], seen));
    }
    return result;
  }
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  if (input instanceof Map) {
    const result = new Map;
    seen.set(input, result);
    for (const [key, value] of input) {
      result.set(deepToRaw(key, seen), deepToRaw(value, seen));
    }
    return result;
  }
  if (input instanceof Set) {
    const result = new Set;
    seen.set(input, result);
    for (const value of input) {
      result.add(deepToRaw(value, seen));
    }
    return result;
  }
  const source = isReactive(input) ? toRaw(input) : input;
  if (seen.has(source)) {
    return seen.get(source);
  }
  if (source && typeof source === "object" && (source.constructor === Object || source.constructor === null)) {
    const result = Object.create(Object.getPrototypeOf(source));
    seen.set(input, result);
    seen.set(source, result);
    for (const key of Reflect.ownKeys(source)) {
      result[key] = deepToRaw(source[key], seen);
    }
    return result;
  }
  return source;
}
