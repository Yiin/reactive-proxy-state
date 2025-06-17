// src/utils.ts
var deepEqualCache = new WeakMap;
var MAX_CACHE_SIZE = 1000;
var pathCache = new WeakMap;
var pathCacheSize = new WeakMap;
var pathConcatCache = new Map;
var MAX_PATH_CACHE_SIZE = 1000;
var globalSeen = new WeakMap;
var wrapperCache = new WeakMap;
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
function cleanupPathConcatCache() {
  if (pathConcatCache.size > MAX_PATH_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_PATH_CACHE_SIZE * 0.2);
    let count = 0;
    for (const key of pathConcatCache.keys()) {
      if (count >= entriesToRemove)
        break;
      pathConcatCache.delete(key);
      count++;
    }
  }
}
function deepEqual(a, b, seen = globalSeen) {
  if (a === b)
    return true;
  if (a == null || b == null)
    return a === b;
  if (typeof a !== typeof b)
    return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (typeof a !== "object")
    return false;
  if (Array.isArray(a) !== Array.isArray(b))
    return false;
  if (seen.has(a))
    return seen.get(a) === b;
  seen.set(a, b);
  if (deepEqualCache.has(a) && deepEqualCache.get(a)?.has(b)) {
    return deepEqualCache.get(a).get(b);
  }
  if (!deepEqualCache.has(a)) {
    deepEqualCache.set(a, new WeakMap);
  }
  let result;
  if (Array.isArray(a)) {
    result = a.length === b.length && a.every((val, idx) => deepEqual(val, b[idx], seen));
  } else {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    result = keysA.length === keysB.length && keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key], seen));
  }
  deepEqualCache.get(a).set(b, result);
  return result;
}
function getFromPathCache(root, pathKey) {
  const cache = pathCache.get(root);
  if (!cache)
    return;
  const result = cache.get(pathKey);
  if (result !== undefined) {
    cache.delete(pathKey);
    cache.set(pathKey, result);
  }
  return result;
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
function getPathConcat(path) {
  const result = pathConcatCache.get(path);
  if (result !== undefined) {
    pathConcatCache.delete(path);
    pathConcatCache.set(path, result);
  }
  return result;
}
function setPathConcat(path, value) {
  if (pathConcatCache.has(path)) {
    pathConcatCache.delete(path);
  }
  pathConcatCache.set(path, value);
  cleanupPathConcatCache();
}
function isObject(val) {
  return val !== null && typeof val === "object";
}
function traverse(value, seen = new Set) {
  if (!isObject(value) || seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.length;
    for (let i = 0;i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (value instanceof Set || value instanceof Map) {
    for (const v of value) {
      if (Array.isArray(v)) {
        traverse(v[0], seen);
        traverse(v[1], seen);
      } else {
        traverse(v, seen);
      }
    }
    return value;
  } else {
    for (const key in value) {
      traverse(value[key], seen);
    }
  }
  return value;
}
function deepClone(value, seen = new WeakMap) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const newArray = [];
    seen.set(value, newArray);
    for (let i = 0;i < value.length; i++) {
      newArray[i] = deepClone(value[i], seen);
    }
    return newArray;
  }
  if (value instanceof Map) {
    const newMap = new Map;
    seen.set(value, newMap);
    value.forEach((val, key) => {
      newMap.set(deepClone(key, seen), deepClone(val, seen));
    });
    return newMap;
  }
  if (value instanceof Set) {
    const newSet = new Set;
    seen.set(value, newSet);
    value.forEach((val) => {
      newSet.add(deepClone(val, seen));
    });
    return newSet;
  }
  const newObject = Object.create(Object.getPrototypeOf(value));
  seen.set(value, newObject);
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
var actionHandlers = {
  set: function(parent, key, event) {
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
  "map-set": function(targetMap, _parentKeyIgnored, event) {
    if (!(targetMap instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap.set(event.key, event.newValue);
  },
  "map-delete": function(targetMap, _parentKeyIgnored, event) {
    if (!(targetMap instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap.delete(event.key);
  },
  "map-clear": function(targetMap, _parentKeyIgnored, event) {
    if (!(targetMap instanceof Map)) {
      console.warn(`expected map at path ${event.path.join(".")}`);
      return;
    }
    targetMap.clear();
  },
  "set-add": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.add(event.value);
  },
  "set-delete": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.delete(event.value);
  },
  "set-clear": function(targetSet, _keyIgnored, event) {
    if (!(targetSet instanceof Set)) {
      console.warn(`expected set at path ${event.path.join(".")}`);
      return;
    }
    targetSet.clear();
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
      for (const [key, value] of newValueEntries) {
        target.set(key, value);
      }
    } else if (target instanceof Set && newValue instanceof Set) {
      const newValueEntries = [...newValue.values()];
      target.clear();
      for (const value of newValueEntries) {
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
}
// src/watch-effect.ts
var activeEffect = null;
var queuedEffects = new Map;
var isFlushing = false;
var currentTriggerDepth = 0;
function setActiveEffect(effect) {
  activeEffect = effect;
}
var targetMap = new WeakMap;
function cleanupEffect(effect) {
  if (effect.dependencies) {
    effect.dependencies.forEach((dep) => {
      dep.delete(effect);
    });
    effect.dependencies.clear();
  }
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
function track(target, key) {
  if (!activeEffect || !activeEffect.active)
    return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map;
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set;
    depsMap.set(key, dep);
  }
  const effectToAdd = activeEffect;
  if (!dep.has(effectToAdd)) {
    dep.add(effectToAdd);
    if (!effectToAdd.dependencies) {
      effectToAdd.dependencies = new Set;
    }
    effectToAdd.dependencies.add(dep);
    if (effectToAdd.options?.onTrack) {
      effectToAdd.options.onTrack({ effect: effectToAdd._rawCallback, target, key, type: "track" });
    }
  }
}
function flushEffects() {
  if (isFlushing)
    return;
  isFlushing = true;
  try {
    let minDepth = Infinity;
    for (const depth of queuedEffects.values()) {
      if (depth < minDepth)
        minDepth = depth;
    }
    const effectsToRun = [];
    for (const [effect, depth] of queuedEffects.entries()) {
      if (depth === minDepth) {
        effectsToRun.push(effect);
        queuedEffects.delete(effect);
      }
    }
    for (const effect of effectsToRun) {
      if (effect.active) {
        if (effect.options?.scheduler) {
          effect.options.scheduler(effect.run);
        } else {
          effect.run();
        }
      }
    }
  } finally {
    isFlushing = false;
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  }
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap)
    return;
  currentTriggerDepth++;
  const triggerLevel = currentTriggerDepth;
  try {
    const addEffects = (depKey) => {
      const dep = depsMap.get(depKey);
      if (dep) {
        dep.forEach((effect) => {
          if (effect !== activeEffect && effect.active) {
            if (effect.options?.onTrigger) {
              effect.options.onTrigger({ effect: effect._rawCallback, target, key, type: "trigger" });
            }
            if (!queuedEffects.has(effect) || triggerLevel < queuedEffects.get(effect)) {
              queuedEffects.set(effect, triggerLevel);
            }
          }
        });
      }
    };
    addEffects(key);
    if (queuedEffects.size > 0) {
      flushEffects();
    }
  } finally {
    currentTriggerDepth--;
  }
}
function watchEffect(effectCallback, options = {}) {
  const run = () => {
    if (!effectFn.active) {
      throw new Error("Trying to run a stopped effect");
    }
    const previousEffect = activeEffect;
    try {
      runCleanupFunctions(effectFn);
      cleanupEffect(effectFn);
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
    }
  };
  const effectFn = {
    run,
    dependencies: new Set,
    options,
    active: true,
    _rawCallback: effectCallback,
    cleanupFns: []
  };
  if (!options.lazy) {
    effectFn.run();
  }
  const stopHandle = () => {
    if (effectFn.active) {
      runCleanupFunctions(effectFn);
      cleanupEffect(effectFn);
      effectFn.active = false;
      queuedEffects.delete(effectFn);
    }
  };
  stopHandle.effect = effectFn;
  return stopHandle;
}

// src/wrap-set.ts
function wrapSet(set, emit, path = []) {
  const cachedProxy = wrapperCache.get(set);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(set))
    return globalSeen.get(set);
  const methodCache = {};
  const proxy = new Proxy(set, {
    get(target, prop, receiver) {
      track(target, prop);
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
      }
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      if (prop === "add") {
        methodCache[prop] = function(value2) {
          const existed = target.has(value2);
          const oldSize = target.size;
          if (!existed) {
            target.add(value2);
            const newSize = target.size;
            const event = {
              action: "set-add",
              path,
              value: value2
            };
            emit?.(event);
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
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
            const result = target.delete(value2);
            const newSize = target.size;
            if (result) {
              const event = {
                action: "set-delete",
                path,
                value: value2,
                oldValue
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldSize !== newSize) {
                trigger(target, "size");
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
          target.clear();
          const newSize = target.size;
          const event = {
            action: "set-clear",
            path,
            value: null
          };
          emit?.(event);
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
          }
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        track(target, Symbol.iterator);
        methodCache[prop] = function(value2) {
          if (typeof value2 === "string" || typeof value2 === "number" || typeof value2 === "symbol") {
            track(target, String(value2));
          }
          return target.has(value2);
        }.bind(target);
        return methodCache[prop];
      }
      if (prop === "values" || prop === Symbol.iterator || prop === "entries" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
        const originalMethod = Reflect.get(target, prop, receiver);
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const valuesIterator = proxy.values();
            for (const value2 of valuesIterator) {
              callbackfn.call(thisArg, value2, value2, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function* (...args) {
          let index = 0;
          const iterator = originalMethod.apply(target, args);
          for (const entry of iterator) {
            let valueToWrap = entry;
            if (prop === "entries") {
              valueToWrap = entry[1];
            }
            track(target, String(index));
            let wrappedValue = valueToWrap;
            if (valueToWrap && typeof valueToWrap === "object") {
              if (globalSeen.has(valueToWrap)) {
                wrappedValue = globalSeen.get(valueToWrap);
              } else {
                const cachedValueProxy = wrapperCache.get(valueToWrap);
                if (cachedValueProxy) {
                  wrappedValue = cachedValueProxy;
                } else {
                  const keyForPath = String(index);
                  const pathKey = path.length > 0 ? `${path.join(".")}.${keyForPath}` : keyForPath;
                  let newPath = getPathConcat(pathKey);
                  if (newPath === undefined) {
                    newPath = path.concat(keyForPath);
                    setPathConcat(pathKey, newPath);
                  }
                  if (valueToWrap instanceof Map)
                    wrappedValue = wrapMap(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Set)
                    wrappedValue = wrapSet(valueToWrap, emit, newPath);
                  else if (Array.isArray(valueToWrap))
                    wrappedValue = wrapArray(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Date)
                    wrappedValue = new Date(valueToWrap.getTime());
                  else
                    wrappedValue = reactive(valueToWrap, emit, newPath);
                }
              }
            }
            if (prop === "entries") {
              yield [wrappedValue, wrappedValue];
            } else {
              yield wrappedValue;
            }
            index++;
          }
        };
        return methodCache[prop];
      }
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  });
  globalSeen.set(set, proxy);
  wrapperCache.set(set, proxy);
  return proxy;
}

// src/wrap-map.ts
function wrapMap(map, emit, path = []) {
  const cachedProxy = wrapperCache.get(map);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(map))
    return globalSeen.get(map);
  const methodCache = {};
  const proxy = new Proxy(map, {
    get(target, prop, receiver) {
      track(target, prop);
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
      }
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      if (prop === "set") {
        methodCache[prop] = function(key, value2) {
          const existed = target.has(key);
          const oldValue = target.get(key);
          const oldSize = target.size;
          if (oldValue === value2)
            return receiver;
          if (oldValue && typeof oldValue === "object" && value2 && typeof value2 === "object" && deepEqual(oldValue, value2, new WeakMap))
            return receiver;
          target.set(key, value2);
          const newSize = target.size;
          const pathKey = path.join(".");
          let cachedPath = getPathConcat(pathKey);
          if (cachedPath === undefined) {
            cachedPath = path;
            setPathConcat(pathKey, cachedPath);
          }
          const event = {
            action: "map-set",
            path: cachedPath,
            key,
            oldValue,
            newValue: value2
          };
          emit?.(event);
          if (!existed) {
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
          } else {
            trigger(target, String(key));
          }
          return receiver;
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
          const result = target.delete(key);
          const newSize = target.size;
          if (result) {
            const pathKey = path.join(".");
            let cachedPath = getPathConcat(pathKey);
            if (cachedPath === undefined) {
              cachedPath = path;
              setPathConcat(pathKey, cachedPath);
            }
            const event = {
              action: "map-delete",
              path: cachedPath,
              key,
              oldValue
            };
            emit?.(event);
            trigger(target, Symbol.iterator);
            if (oldSize !== newSize) {
              trigger(target, "size");
            }
            trigger(target, String(key));
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
          target.clear();
          const newSize = target.size;
          const event = {
            action: "map-clear",
            path,
            key: null
          };
          emit?.(event);
          trigger(target, Symbol.iterator);
          if (oldSize !== newSize) {
            trigger(target, "size");
          }
        };
        return methodCache[prop];
      }
      if (prop === "get") {
        methodCache[prop] = function(key) {
          track(target, String(key));
          const value2 = target.get(key);
          if (!value2 || typeof value2 !== "object")
            return value2;
          if (globalSeen.has(value2))
            return globalSeen.get(value2);
          const cachedValueProxy = wrapperCache.get(value2);
          if (cachedValueProxy)
            return cachedValueProxy;
          const keyString = String(key);
          const pathKey = path.length > 0 ? `${path.join(".")}.${keyString}` : keyString;
          let newPath = getPathConcat(pathKey);
          if (newPath === undefined) {
            newPath = path.concat(keyString);
            setPathConcat(pathKey, newPath);
          }
          if (value2 instanceof Map)
            return wrapMap(value2, emit, newPath);
          if (value2 instanceof Set)
            return wrapSet(value2, emit, newPath);
          if (Array.isArray(value2))
            return wrapArray(value2, emit, newPath);
          if (value2 instanceof Date)
            return new Date(value2.getTime());
          return reactive(value2, emit, newPath);
        };
        return methodCache[prop];
      }
      if (prop === "has") {
        track(target, Symbol.iterator);
        methodCache[prop] = function(key) {
          track(target, String(key));
          return target.has(key);
        }.bind(target);
        return methodCache[prop];
      }
      if (prop === Symbol.iterator || prop === "entries" || prop === "values" || prop === "keys" || prop === "forEach") {
        track(target, Symbol.iterator);
        const originalMethod = Reflect.get(target, prop, receiver);
        if (prop === "forEach") {
          methodCache[prop] = (callbackfn, thisArg) => {
            const entriesIterator = proxy.entries();
            for (const [key, value2] of entriesIterator) {
              callbackfn.call(thisArg, value2, key, proxy);
            }
          };
          return methodCache[prop];
        }
        methodCache[prop] = function* (...args) {
          const iterator = originalMethod.apply(target, args);
          for (const entry of iterator) {
            let keyToWrap = entry;
            let valueToWrap = entry;
            let isEntry = false;
            if (prop === "entries" || prop === Symbol.iterator) {
              keyToWrap = entry[0];
              valueToWrap = entry[1];
              isEntry = true;
            }
            let wrappedKey = keyToWrap;
            if (isEntry && keyToWrap && typeof keyToWrap === "object") {
              if (globalSeen.has(keyToWrap)) {
                wrappedKey = globalSeen.get(keyToWrap);
              } else {
                const pathKey = path.length > 0 ? `${path.join(".")}.${String(keyToWrap)}` : String(keyToWrap);
                let keyPath = getPathConcat(pathKey);
                if (keyPath === undefined) {
                  keyPath = path.concat(String(keyToWrap));
                  setPathConcat(pathKey, keyPath);
                }
                wrappedKey = reactive(keyToWrap, emit, keyPath);
              }
            }
            let wrappedValue = valueToWrap;
            if (valueToWrap && typeof valueToWrap === "object") {
              if (globalSeen.has(valueToWrap)) {
                wrappedValue = globalSeen.get(valueToWrap);
              } else {
                const cachedValueProxy = wrapperCache.get(valueToWrap);
                if (cachedValueProxy) {
                  wrappedValue = cachedValueProxy;
                } else {
                  const keyString = String(keyToWrap);
                  const pathKey = path.length > 0 ? `${path.join(".")}.${keyString}` : keyString;
                  let newPath = getPathConcat(pathKey);
                  if (newPath === undefined) {
                    newPath = path.concat(keyString);
                    setPathConcat(pathKey, newPath);
                  }
                  if (valueToWrap instanceof Map)
                    wrappedValue = wrapMap(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Set)
                    wrappedValue = wrapSet(valueToWrap, emit, newPath);
                  else if (Array.isArray(valueToWrap))
                    wrappedValue = wrapArray(valueToWrap, emit, newPath);
                  else if (valueToWrap instanceof Date)
                    wrappedValue = new Date(valueToWrap.getTime());
                  else
                    wrappedValue = reactive(valueToWrap, emit, newPath);
                }
              }
            }
            if (prop === "entries" || prop === Symbol.iterator) {
              yield [wrappedKey, wrappedValue];
            } else if (prop === "values") {
              yield wrappedValue;
            } else {
              yield wrappedKey;
            }
          }
        };
        return methodCache[prop];
      }
      if (prop === "size") {
        track(target, "size");
        return target.size;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  });
  globalSeen.set(map, proxy);
  wrapperCache.set(map, proxy);
  return proxy;
}

// src/wrap-array.ts
function isObject2(v) {
  return v && typeof v === "object";
}
function wrapArray(arr, emit, path = []) {
  const cachedProxy = wrapperCache.get(arr);
  if (cachedProxy)
    return cachedProxy;
  if (globalSeen.has(arr))
    return globalSeen.get(arr);
  const methodCache = {};
  const proxy = new Proxy(arr, {
    get(target, prop, receiver) {
      track(target, prop);
      if (methodCache[prop]) {
        return methodCache[prop];
      }
      switch (prop) {
        case "push":
          track(target, "length");
          methodCache[prop] = function(...items) {
            const oldLength = target.length;
            const result = target.push(...items);
            const newLength = target.length;
            if (items.length > 0) {
              const event = {
                action: "array-push",
                path,
                key: oldLength,
                items
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case "pop":
          track(target, "length");
          methodCache[prop] = function() {
            if (target.length === 0)
              return;
            const oldLength = target.length;
            const poppedIndex = oldLength - 1;
            const oldValue = target[poppedIndex];
            const result = target.pop();
            const newLength = target.length;
            const event = {
              action: "array-pop",
              path,
              key: poppedIndex,
              oldValue
            };
            emit?.(event);
            trigger(target, Symbol.iterator);
            if (oldLength !== newLength) {
              trigger(target, "length");
            }
            return result;
          };
          return methodCache[prop];
        case "shift":
          track(target, "length");
          methodCache[prop] = function() {
            if (target.length === 0)
              return;
            const oldLength = target.length;
            const oldValue = target[0];
            const result = target.shift();
            const newLength = target.length;
            const event = {
              action: "array-shift",
              path,
              key: 0,
              oldValue
            };
            emit?.(event);
            trigger(target, Symbol.iterator);
            if (oldLength !== newLength) {
              trigger(target, "length");
            }
            return result;
          };
          return methodCache[prop];
        case "unshift":
          track(target, "length");
          methodCache[prop] = function(...items) {
            const oldLength = target.length;
            const result = target.unshift(...items);
            const newLength = target.length;
            if (items.length > 0) {
              const event = {
                action: "array-unshift",
                path,
                key: 0,
                items
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case "splice":
          track(target, "length");
          methodCache[prop] = function(start, deleteCount, ...items) {
            const oldLength = target.length;
            const actualStart = start < 0 ? Math.max(target.length + start, 0) : Math.min(start, target.length);
            const deleteCountNum = deleteCount === undefined ? target.length - actualStart : Number(deleteCount);
            const actualDeleteCount = Math.min(deleteCountNum, target.length - actualStart);
            const deletedItems = target.slice(actualStart, actualStart + actualDeleteCount);
            const result = target.splice(start, deleteCountNum, ...items);
            const newLength = target.length;
            if (actualDeleteCount > 0 || items.length > 0) {
              const event = {
                action: "array-splice",
                path,
                key: actualStart,
                deleteCount: actualDeleteCount,
                items: items.length > 0 ? items : undefined,
                oldValues: deletedItems.length > 0 ? deletedItems : undefined
              };
              emit?.(event);
              trigger(target, Symbol.iterator);
              if (oldLength !== newLength) {
                trigger(target, "length");
              }
            }
            return result;
          };
          return methodCache[prop];
        case Symbol.iterator:
        case "values":
        case "keys":
        case "entries":
        case "forEach":
        case "map":
        case "filter":
        case "reduce":
        case "reduceRight":
        case "find":
        case "findIndex":
        case "every":
        case "some":
        case "join":
          track(target, Symbol.iterator);
          break;
        case "length":
          track(target, "length");
          return Reflect.get(target, prop, receiver);
      }
      const value = Reflect.get(target, prop, receiver);
      const isNumericIndex = typeof prop === "number" || typeof prop === "string" && !isNaN(parseInt(prop, 10));
      if (isNumericIndex) {
        track(target, String(prop));
        if (!isObject2(value))
          return value;
        if (globalSeen.has(value))
          return globalSeen.get(value);
        const cachedValueProxy = wrapperCache.get(value);
        if (cachedValueProxy)
          return cachedValueProxy;
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        if (Array.isArray(value))
          return wrapArray(value, emit, newPath);
        if (value instanceof Map)
          return wrapMap(value, emit, newPath);
        if (value instanceof Set)
          return wrapSet(value, emit, newPath);
        if (value instanceof Date)
          return new Date(value.getTime());
        return reactive(value, emit, newPath);
      }
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const oldValue = target[prop];
      if (oldValue === value)
        return true;
      if (isObject2(oldValue) && isObject2(value) && deepEqual(oldValue, value, new WeakMap))
        return true;
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const result = Reflect.set(target, prop, value, receiver);
      const isNumericIndex = typeof prop === "number" || typeof prop === "string" && !isNaN(parseInt(String(prop)));
      if (result && (!descriptor || !descriptor.set || isNumericIndex)) {
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        const event = {
          action: "set",
          path: newPath,
          oldValue,
          newValue: value
        };
        emit?.(event);
        trigger(target, prop);
      }
      return result;
    }
  });
  globalSeen.set(arr, proxy);
  wrapperCache.set(arr, proxy);
  return proxy;
}

// src/constants.ts
var ReactiveFlags;
((ReactiveFlags2) => {
  ReactiveFlags2["RAW"] = "__v_raw";
  ReactiveFlags2["IS_REACTIVE"] = "__v_isReactive";
  ReactiveFlags2["SKIP"] = "__v_skip";
})(ReactiveFlags ||= {});

// src/reactive.ts
function isObject3(v) {
  return v && typeof v === "object";
}
function isReactive(value) {
  return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}
function toRaw(observed) {
  const raw = observed && observed["__v_raw" /* RAW */];
  return raw ? toRaw(raw) : observed;
}
function reactive(obj, emit, path = []) {
  if (globalSeen.has(obj))
    return globalSeen.get(obj);
  if (emit && path.length === 0) {
    try {
      const initialEvent = {
        action: "replace",
        path: [],
        newValue: obj
      };
      emit(initialEvent);
    } catch (error) {
      console.error("Failed to emit initial reactive state:", error);
    }
  }
  if (Array.isArray(obj)) {
    return wrapArray(obj, emit, path);
  }
  if (obj instanceof Map) {
    return wrapMap(obj, emit, path);
  }
  if (obj instanceof Set) {
    return wrapSet(obj, emit, path);
  }
  function wrapValue(val, subPath) {
    if (!isObject3(val))
      return val;
    if (globalSeen.has(val))
      return globalSeen.get(val);
    if (Array.isArray(val))
      return wrapArray(val, emit, subPath);
    if (val instanceof Map)
      return wrapMap(val, emit, subPath);
    if (val instanceof Set)
      return wrapSet(val, emit, subPath);
    if (val instanceof Date)
      return new Date(val.getTime());
    return reactive(val, emit, subPath);
  }
  const proxy = new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === "__v_raw" /* RAW */) {
        return target;
      }
      if (prop === "__v_isReactive" /* IS_REACTIVE */) {
        return true;
      }
      const value = Reflect.get(target, prop, receiver);
      track(target, prop);
      if (!isObject3(value))
        return value;
      const propKey = String(prop);
      const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
      let newPath = getPathConcat(pathKey);
      if (newPath === undefined) {
        newPath = path.concat(propKey);
        setPathConcat(pathKey, newPath);
      }
      return wrapValue(value, newPath);
    },
    set(target, prop, value, receiver) {
      const oldValue = target[prop];
      if (oldValue === value)
        return true;
      if (isObject3(oldValue) && isObject3(value) && deepEqual(oldValue, value, new WeakMap))
        return true;
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      const result = Reflect.set(target, prop, value, receiver);
      if (result && (!descriptor || !descriptor.set)) {
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        const event = {
          action: "set",
          path: newPath,
          oldValue,
          newValue: value
        };
        emit?.(event);
        trigger(target, prop);
      }
      return result;
    },
    deleteProperty(target, prop) {
      const oldValue = target[prop];
      const hadProperty = Object.prototype.hasOwnProperty.call(target, prop);
      const result = Reflect.deleteProperty(target, prop);
      if (hadProperty && result) {
        const propKey = String(prop);
        const pathKey = path.length > 0 ? `${path.join(".")}.${propKey}` : propKey;
        let newPath = getPathConcat(pathKey);
        if (newPath === undefined) {
          newPath = path.concat(propKey);
          setPathConcat(pathKey, newPath);
        }
        const event = {
          action: "delete",
          path: newPath,
          oldValue
        };
        emit?.(event);
        trigger(target, prop);
      }
      return result;
    }
  });
  globalSeen.set(obj, proxy);
  return proxy;
}
// src/watch.ts
function watch(sourceInput, callback, options = {}) {
  const { immediate = false, deep = true } = options;
  const source = typeof sourceInput === "function" ? sourceInput : () => sourceInput;
  let oldValue;
  let initialized = false;
  const stopEffect = watchEffect(() => {
    const currentValue = source();
    if (deep) {
      traverse(currentValue);
    }
    if (initialized) {
      let hasChanged = false;
      hasChanged = deep || currentValue !== oldValue;
      if (hasChanged) {
        const prevOldValue = oldValue;
        oldValue = deep ? deepClone(currentValue) : currentValue;
        callback(currentValue, prevOldValue);
      }
    } else {
      oldValue = deep ? deepClone(currentValue) : currentValue;
      initialized = true;
      if (immediate) {
        callback(currentValue, undefined);
      }
    }
  }, { lazy: false });
  return stopEffect;
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
  const stopHandle = watchEffect(getter, {
    lazy: true,
    scheduler: () => {
      if (!_dirty) {
        _dirty = true;
        trigger(computedRef, "value");
      }
    }
  });
  const effectRunner = stopHandle.effect;
  computedRef = {
    [isRefSymbol]: true,
    [isComputedSymbol]: true,
    get value() {
      track(computedRef, "value");
      if (_dirty) {
        _value = effectRunner.run();
        _dirty = false;
      }
      return _value;
    },
    set value(newValue) {
      if (setter) {
        setter(newValue);
      } else {
        console.warn("computed value is read-only");
      }
    }
  };
  return computedRef;
}
function isComputed(c) {
  return !!(c && c[isComputedSymbol]);
}
export {
  wrapperCache,
  wrapSet,
  wrapMap,
  wrapArray,
  watchEffect,
  watch,
  updateState,
  unref,
  triggerRef,
  trigger,
  traverse,
  track,
  toRefs,
  toRef,
  toRaw,
  setPathConcat,
  setInPathCache,
  setActiveEffect,
  runCleanupFunctions,
  ref,
  reactive,
  pathConcatCache,
  pathCache,
  isRefSymbol,
  isRef,
  isReactive,
  isComputed,
  globalSeen,
  getPathConcat,
  getFromPathCache,
  deepEqual,
  deepClone,
  computed,
  cleanupEffect,
  activeEffect,
  ReactiveFlags
};
