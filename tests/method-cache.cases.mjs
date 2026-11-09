// The method cache checks, run by Bun (tests/method-cache.bun.test.ts) and by
// Node on a bundle of the current source: node tests/method-cache.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * The proxies cache their wrapped methods in an object whose prototype has
 * no prototype (3.0.11). A read finds only the methods put in it, so every
 * name of Object.prototype still reads what the collection gives, before and
 * after the cache holds methods, and on a second read from the cache.
 */
const objectNames = [...Object.getOwnPropertyNames(Object.prototype), "__proto__"];

const collections = {
  array: () => [1, 2, 3],
  Map: () => new Map([["a", 1]]),
  Set: () => new Set([1, 2]),
};

/** Methods each collection's proxy caches when they are read. */
const cachedMethods = {
  array: ["map", "push", "find", "at", Symbol.iterator, "values", "keys", "entries", "slice"],
  Map: ["get", "set", "has", "delete", Symbol.iterator, "values", "forEach"],
  Set: ["add", "has", "delete", Symbol.iterator, "values", "forEach", "union"],
};

/** Keys that are no array index but that `parseInt` reads as a number. */
const numericLooking = ["00", "01", "1.5", "-1", "+1", " 1", "1e1", "4294967295", "9x", "2abc"];
/** Keys that are no index and that `parseInt` cannot read. */
const named = ["", "custom", "Infinity", "NaN", "-x"];

/** Runs `body` with `name` of `prototype` replaced by `value` (or deleted), then restores it. */
function withPrototype(prototype, name, value, body) {
  const saved = Object.getOwnPropertyDescriptor(prototype, name);
  try {
    if (value === undefined) delete prototype[name];
    else Object.defineProperty(prototype, name, { value, writable: true, configurable: true, enumerable: false });
    body();
  } finally {
    if (saved === undefined) delete prototype[name];
    else Object.defineProperty(prototype, name, saved);
  }
}

/** The events of `state` as [action, path, newValue], with functions by name. */
function eventLog() {
  const log = [];
  const emit = (event) => {
    const value = typeof event.newValue === "function" ? `function ${event.newValue.name}` : event.newValue;
    log.push([event.action, event.path.join("."), JSON.stringify(value)]);
  };
  return { log, emit };
}

/** `{ name: check }` for the library `lib`. */
export function methodCacheCases(lib) {
  const { reactive, toRaw, isReactive, watchEffect } = lib;
  const cases = {};

  for (const [kind, make] of Object.entries(collections)) {
    for (const warm of [false, true]) {
      cases[`Object.prototype names read through a ${kind} proxy are the collection's, ${warm ? "after" : "before"} methods are cached`] = () => {
        const state = reactive({ value: make() }, () => {});
        const proxy = state.value;
        const raw = toRaw(proxy);
        if (warm) for (const name of cachedMethods[kind]) proxy[name];
        for (const name of objectNames) {
          for (let read = 0; read < 2; read++) assert.equal(typeof proxy[name], typeof raw[name], name);
        }
        assert.equal(proxy.constructor, raw.constructor);
        assert.equal(proxy.__proto__, Object.getPrototypeOf(raw));
        assert.equal(proxy.valueOf(), proxy);
        assert.equal(proxy.toString(), raw.toString());
        assert.equal(proxy.toLocaleString(), raw.toLocaleString());
        assert.equal(proxy.hasOwnProperty("0"), raw.hasOwnProperty("0"));
        assert.equal(proxy.hasOwnProperty("get"), false);
        assert.equal(proxy.propertyIsEnumerable("0"), raw.propertyIsEnumerable("0"));
        assert.equal(proxy.isPrototypeOf(raw), false);
        assert.equal(Object.prototype.toString.call(proxy), Object.prototype.toString.call(raw));
      };
    }
  }

  cases["the cached methods still work after Object.prototype names were read"] = () => {
    const state = reactive({ list: [1, 2], map: new Map([["a", 1]]), set: new Set([1]) }, () => {});
    for (const name of objectNames) {
      state.list[name];
      state.map[name];
      state.set[name];
    }
    assert.deepEqual([...state.list], [1, 2]);
    assert.deepEqual(state.list.map((x) => x * 2), [2, 4]);
    assert.equal(state.map.get("a"), 1);
    assert.equal(state.set.has(1), true);
    assert.equal(`${state.list}`, "1,2");
  };

  // Index reads return before the method cache (3.0.11). Every other key
  // that `parseInt` reads as a number is wrapped like an index, so a write
  // through it emits at that key. "" and names read what the array holds,
  // unwrapped: they are no items of the array.
  cases["index-like keys wrap like indexes; empty and named keys read the raw value"] = () => {
    const raw = [10, { n: 1 }, 30];
    for (const key of [...numericLooking, ...named]) raw[key] = { key };
    raw.number = 7;
    const state = reactive({ list: raw }, () => {});
    const list = state.list;
    assert.equal(list[0], 10);
    assert.equal(list["0"], 10);
    assert.equal(list[1].n, 1);
    assert.equal(isReactive(list[1]), true);
    assert.equal(toRaw(list[1]), raw[1]);
    assert.equal(list[2], 30);
    assert.equal(list[3], undefined);
    assert.equal(list["4294967294"], undefined);
    assert.equal(list.length, 3);
    assert.equal(list.number, 7);
    for (const key of numericLooking) {
      assert.equal(isReactive(list[key]), true, JSON.stringify(key));
      assert.equal(toRaw(list[key]), raw[key], JSON.stringify(key));
      assert.equal(list[key].key, key);
    }
    for (const key of named) {
      assert.equal(isReactive(list[key]), false, JSON.stringify(key));
      assert.equal(list[key], raw[key], JSON.stringify(key));
    }
    assert.equal(typeof list[Symbol.iterator], "function");
    assert.equal(list[Symbol.toStringTag], undefined);
  };

  cases["a write through an item read by index or by a numeric-looking key emits at that key"] = () => {
    const events = [];
    const raw = [{ n: 1 }];
    raw["01"] = { n: 2 };
    raw.custom = { n: 3 };
    const state = reactive({ list: raw }, (event) => events.push(event));
    events.length = 0;
    state.list[0].n = 5;
    state.list["01"].n = 6;
    // a named key reads the raw object: the write is outside the state
    state.list.custom.n = 7;
    assert.deepEqual(events.map((event) => [event.action, event.path, event.newValue]), [
      ["set", ["list", "0", "n"], 5],
      ["set", ["list", "01", "n"], 6],
    ]);
  };

  // Object.defineProperty with a value through an array proxy is a write:
  // the same events as the same write with `=`, and the same effects rerun.
  for (const [key, value] of [["0", { n: 9 }], ["1", 5], ["3", 4], ["8", 1], ["length", 1], ["length", 5], ["custom", 7], ["map", function own() {}]]) {
    cases[`defineProperty(${key}) through an array proxy sends what a write with = sends`] = () => {
      const run = (write) => {
        const { log, emit } = eventLog();
        const state = reactive({ list: [{ n: 1 }, 2, 3] }, emit);
        state.list.map;
        let runs = 0;
        const stop = watchEffect(() => {
          runs++;
          state.list[key];
          state.list.length;
        });
        log.length = 0;
        write(state.list);
        stop();
        return { log, runs, list: toRaw(state.list).slice(), own: Object.keys(toRaw(state.list)) };
      };
      const assigned = run((list) => (list[key] = value));
      const flags = key === "length" ? {} : { writable: true, enumerable: true, configurable: true };
      const defined = run((list) => Object.defineProperty(list, key, { value, ...flags }));
      assert.deepEqual(defined, assigned);
      assert.ok(assigned.log.length > 0 && assigned.runs === 2, JSON.stringify(assigned));
    };
  }

  cases["a method defined on an array proxy after the proxy cached it is the one read"] = () => {
    const { log, emit } = eventLog();
    const state = reactive({ list: [1, 2] }, emit);
    const list = state.list;
    assert.deepEqual(list.map((x) => x + 1), [2, 3]);
    let runs = 0;
    const stop = watchEffect(() => {
      runs++;
      list.map;
    });
    log.length = 0;
    const own = function own() {
      return "own";
    };
    Object.defineProperty(list, "map", { value: own, writable: true, configurable: true });
    assert.equal(list.map(), "own");
    assert.equal(toRaw(list).map, own);
    assert.equal(runs, 2);
    assert.deepEqual(log, [["set", "list.map", '"function own"']]);
    delete list.map;
    assert.deepEqual(list.map((x) => x * 2), [2, 4]);
    assert.equal(runs, 3);
    // an accessor: effects rerun and no event is sent
    log.length = 0;
    Object.defineProperty(list, "slice", { get: () => () => "getter", configurable: true });
    assert.equal(list.slice(), "getter");
    Object.defineProperty(list, "map", { get: () => () => "getter", configurable: true });
    assert.equal(list.map(), "getter");
    assert.equal(runs, 4);
    assert.deepEqual(log, []);
    stop();
  };

  cases["defineProperty with the same value through an array proxy sets the flags and sends nothing"] = () => {
    const { log, emit } = eventLog();
    const state = reactive({ list: [{ n: 1 }, 2] }, emit);
    const list = state.list;
    const item = toRaw(list)[0];
    log.length = 0;
    assert.equal(Reflect.defineProperty(list, "1", { value: 2, writable: false }), true);
    // a structurally equal object keeps the one stored
    assert.equal(Reflect.defineProperty(list, "0", { value: { n: 1 }, enumerable: false }), true);
    assert.equal(toRaw(list)[0], item);
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(list), "1").writable, false);
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(list), "0").enumerable, false);
    assert.equal(Reflect.set(list, "1", 3), false);
    assert.equal(list[1], 2);
    assert.deepEqual(log, []);
  };

  // A write goes to the target, except through an own setter, which runs
  // with the proxy as `this`: its own writes send their events.
  cases["an own setter of an array runs with the proxy as this, also one defined through the proxy"] = () => {
    const { log, emit } = eventLog();
    const raw = [1];
    Object.defineProperty(raw, "first", { set(value) { this.store = value; }, configurable: true });
    const state = reactive({ list: raw }, emit);
    const list = state.list;
    log.length = 0;
    list.first = 5;
    Object.defineProperty(list, "second", { set(value) { this.other = value; }, configurable: true });
    list.second = 6;
    list[0] = 2;
    assert.deepEqual(log, [
      ["set", "list.store", "5"],
      ["set", "list.other", "6"],
      ["set", "list.0", "2"],
    ]);
    assert.deepEqual([raw.store, raw.other, raw[0]], [5, 6, 2]);
  };

  for (const kind of ["Map", "Set"]) {
    cases[`a method defined on a ${kind} proxy after the proxy cached it is the one read`] = () => {
      const { log, emit } = eventLog();
      const state = reactive({ value: collections[kind]() }, emit);
      const proxy = state.value;
      const names = kind === "Map" ? ["set", "has", "forEach"] : ["has", "add", "union", "forEach"];
      for (const name of names) proxy[name];
      log.length = 0;
      Object.defineProperty(proxy, names[0], { value: () => "defined", configurable: true, writable: true });
      assert.equal(proxy[names[0]](), "defined");
      // a write with = defines the property as well
      proxy[names[1]] = () => "assigned";
      assert.equal(proxy[names[1]](), "assigned");
      // the own properties of a Map or Set are no state
      assert.deepEqual(log, []);
      delete proxy[names[0]];
      delete proxy[names[1]];
      assert.equal(kind === "Map" ? proxy.get("a") : proxy.has(1), kind === "Map" ? 1 : true);
      assert.equal(kind === "Map" ? proxy.has("a") : proxy.add(3), kind === "Map" ? true : proxy);
      assert.equal(log.length, kind === "Map" ? 0 : 1);
    };
  }

  cases["an own method of a fresh Map or Set is read in place of the proxy's"] = () => {
    const map = new Map([["a", 1]]);
    map.get = () => "own get";
    const set = new Set([1]);
    set.union = () => "own union";
    const state = reactive({ map, set }, () => {});
    for (let read = 0; read < 2; read++) {
      assert.equal(state.map.get("a"), "own get");
      assert.equal(state.set.union(new Set()), "own union");
    }
  };

  // Only methods that are the collection prototype's own are cached. A
  // function from Object.prototype is read again each time, so its removal
  // is seen. A built-in method replaced after a proxy read it keeps the one
  // read: patch built-in prototypes before state is made.
  cases["a function added to Object.prototype is read again each time"] = () => {
    const state = reactive({ list: [1], map: new Map(), set: new Set() }, () => {});
    withPrototype(Object.prototype, "extra", function extra() {
      return "extra";
    }, () => {
      for (const name of ["list", "map", "set"]) assert.equal(state[name].extra(), "extra");
      withPrototype(Object.prototype, "extra", undefined, () => {
        for (const name of ["list", "map", "set"]) assert.equal(state[name].extra, undefined, name);
      });
      withPrototype(Object.prototype, "extra", () => "replaced", () => {
        for (const name of ["list", "map", "set"]) assert.equal(state[name].extra(), "replaced", name);
      });
    });
  };

  cases["a built-in method replaced after a proxy read it: that proxy keeps the method it read"] = () => {
    const state = reactive({ old: [1, 2], fresh: [1, 2], oldSet: new Set([1]), freshSet: new Set([1]) }, () => {});
    state.old.slice;
    state.oldSet.union;
    withPrototype(Array.prototype, "slice", () => "replaced", () => {
      withPrototype(Set.prototype, "union", () => "replaced", () => {
        assert.deepEqual(state.old.slice(), [1, 2]);
        assert.equal(state.fresh.slice(), "replaced");
        assert.deepEqual([...state.oldSet.union(new Set([2]))], [1, 2]);
        assert.equal(state.freshSet.union(new Set()), "replaced");
      });
    });
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = methodCacheCases(await import(pathToFileURL(resolve(process.argv[2])).href));
  for (const [name, check] of Object.entries(cases)) {
    try {
      check();
    } catch (error) {
      console.error(`failed: ${name}`);
      throw error;
    }
  }
  console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? "node" : "bun", passed: Object.keys(cases).length }));
}
