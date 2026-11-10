// The cases the 3.0.17 review asked for (3.0.18): a write inside an object
// only hidden keys hold sends nothing, a fixed define of NaN succeeds, and
// a hidden key costs no descriptor read per write. Run by Bun
// (tests/review-317.bun.test.ts) and by Node on a bundle of the current
// source: node tests/review-317.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * A root `{ obj, list, other, rows }` with a replica fed by its events
 * (each crosses a wire), the events, and the warnings `updateState` logged.
 */
function setup(lib, raw = {}) {
  const { reactive, updateState } = lib;
  const source = { obj: { a: 1, b: { n: 1 } }, list: [1, 2], other: { n: 2 }, rows: [{ id: 1 }], ...raw };
  const remote = structuredClone(source);
  const events = [];
  const warnings = [];
  const state = reactive(source, (event) => {
    const wire = structuredClone(event);
    events.push(`${wire.action} ${wire.path.join(".")}${"newValue" in wire ? " " + JSON.stringify(wire.newValue) : ""}`);
    const warn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      updateState(remote, wire);
    } finally {
      console.warn = warn;
    }
  });
  events.length = 0;
  return { state, remote, events, warnings };
}

/** How often each effect ran: one per entry of `reads`, each a function that reads the state. */
function watch(lib, reads) {
  const runs = reads.map(() => 0);
  const stops = reads.map((read, i) =>
    lib.watchEffect(() => {
      runs[i]++;
      read();
    })
  );
  return { runs, stop: () => stops.forEach((stop) => stop()) };
}

/** JSON of a replica and of its source, keys sorted: what a wire carries. */
function sameJson(lib, remote, state) {
  assert.equal(sortedJson(remote), sortedJson(lib.toRaw(state)));
}

function sortedJson(value) {
  return JSON.stringify(value, (key, item) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]]))
      : item
  );
}

/** Counts the descriptor reads and key lists `body` makes. */
function countLooks(body) {
  const descriptor = Reflect.getOwnPropertyDescriptor;
  const ownKeys = Reflect.ownKeys;
  const counts = { descriptors: 0, keyLists: 0 };
  Reflect.getOwnPropertyDescriptor = (target, key) => {
    counts.descriptors++;
    return descriptor(target, key);
  };
  Reflect.ownKeys = (target) => {
    counts.keyLists++;
    return ownKeys(target);
  };
  try {
    body();
  } finally {
    Reflect.getOwnPropertyDescriptor = descriptor;
    Reflect.ownKeys = ownKeys;
  }
  return counts;
}

const hiddenData = (value) => ({ value, writable: true, enumerable: false, configurable: true });

/** `{ name: check }` for the library `lib`. */
export function review317Cases(lib) {
  const { toRaw, isReactive } = lib;
  const cases = {};

  // Part (a) and F3: a place under a hidden key leads to no root. 3.0.17
  // sent the write with its path, and the replica warned per event.
  cases["a write inside an object only a hidden key holds sends nothing, and reruns its readers"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    Object.defineProperty(state.obj, "_meta", hiddenData({ x: 1, deep: { y: 1 }, items: [{ z: 1 }] }));
    const effects = watch(lib, [() => state.obj._meta.x, () => state.obj._meta.deep.y, () => state.obj._meta.items.length]);
    state.obj._meta.x = 2;
    state.obj._meta.deep.y = 2;
    state.obj._meta.deep.added = { k: 1 };
    state.obj._meta.deep.added.k = 2;
    delete state.obj._meta.deep.added;
    state.obj._meta.items.push({ z: 2 });
    state.obj._meta.items[0].z = 3;
    state.obj._meta.items.splice(0, 1);
    effects.stop();
    assert.deepEqual([events, warnings], [[], []]);
    // a key added or deleted reruns every reader of a key of its object
    assert.deepEqual(effects.runs, [2, 4, 3]);
    assert.deepEqual(toRaw(state.obj)._meta, { x: 2, deep: { y: 2 }, items: [{ z: 2 }] });
    sameJson(lib, remote, state);
  };

  cases["an object a hidden and a visible key hold sends each write once, on the visible path"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    Object.defineProperty(state.obj, "_ref", hiddenData(state.other));
    Object.defineProperty(state.list, "_ref", hiddenData(state.other));
    state.other.n = 3;
    state.obj._ref.n = 4;
    state.other.m = { k: 1 };
    state.obj._ref.m.k = 2;
    assert.deepEqual(events, ["set other.n 3", "set other.n 4", 'set other.m {"k":1}', "set other.m.k 2"]);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
    // only hidden keys hold it once the visible key is deleted
    delete state.other;
    events.length = 0;
    state.obj._ref.n = 5;
    assert.deepEqual([events, warnings, toRaw(state.obj)._ref.n], [[], [], 5]);
    sameJson(lib, remote, state);
  };

  cases["a key a define hides detaches its child; shown again, the child's writes are sent"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    const effects = watch(lib, [() => state.obj.b.n]);
    Object.defineProperty(state.obj, "b", { enumerable: false });
    state.obj.b.n = 2;
    state.rows[0].b = state.obj.b;
    state.rows[0].b.n = 3;
    Object.defineProperty(state.rows[0], "b", { enumerable: false });
    state.obj.b.n = 4;
    Object.defineProperty(state.obj, "b", { enumerable: true });
    state.obj.b.n = 5;
    effects.stop();
    assert.deepEqual(events, [
      "delete obj.b",
      'set rows.0.b {"n":2}',
      "set rows.0.b.n 3",
      "delete rows.0.b",
      'set obj.b {"n":4}',
      "set obj.b.n 5",
    ]);
    assert.deepEqual([warnings, effects.runs], [[], [7]]);
    sameJson(lib, remote, state);
  };

  cases["an object under a hidden key of a list item sends nothing"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    Object.defineProperty(state.rows[0], "_cache", hiddenData({ hits: 0 }));
    state.rows[0]._cache.hits++;
    state.rows.push({ id: 2 });
    state.rows.unshift({ id: 0 });
    state.rows[1]._cache.hits++;
    assert.deepEqual(events, ['array-push rows', 'array-unshift rows']);
    assert.deepEqual([warnings, toRaw(state.rows[1])._cache.hits], [[], 2]);
    sameJson(lib, remote, state);
  };

  // Test gap: an array's names that hold objects are not proxied on read,
  // in 3.0.16 and 3.0.17 alike: a write inside one is raw and sends nothing.
  cases["an array name that holds an object reads it raw, hidden or not"] = () => {
    const { state, events } = setup(lib);
    Object.defineProperty(state.list, "hiddenMeta", hiddenData({ x: 1 }));
    state.list.meta = { x: 1 };
    events.length = 0;
    assert.equal(isReactive(state.list.meta), false);
    assert.equal(isReactive(state.list.hiddenMeta), false);
    state.list.meta.x = 2;
    state.list.hiddenMeta.x = 2;
    assert.deepEqual(events, []);
  };

  // F1. 3.0.17 compared the stored and the defined value by `!==`, and
  // refused a fixed define of NaN.
  cases["a fixed define of NaN succeeds as on a plain object, new and over a fixed NaN key"] = () => {
    const { state, remote } = setup(lib);
    const fixed = { value: NaN, writable: false, configurable: false, enumerable: true };
    const plain = {};
    const results = (target) => [Reflect.defineProperty(target, "k", fixed), Reflect.defineProperty(target, "k", { value: NaN })];
    assert.deepEqual(results(plain), [true, true]);
    assert.deepEqual(results(state.obj), [true, true]);
    assert.deepEqual(results(state.list), [true, true]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(toRaw(state.obj), "k"), Object.getOwnPropertyDescriptor(plain, "k"));
    assert.deepEqual(Object.getOwnPropertyDescriptor(toRaw(state.list), "k"), Object.getOwnPropertyDescriptor(plain, "k"));
    assert.equal(Number.isNaN(remote.obj.k), true);
  };

  // F2 and F4. 3.0.17 read a descriptor at each `=` write of an object
  // with a hidden key, also after it was deleted, and listed the keys again
  // after a define of a new enumerable key.
  cases["an object with a hidden key reads no descriptor per write"] = () => {
    const { state, events } = setup(lib, { obj: { a: 1, b: 2 } });
    Object.defineProperty(state.obj, "h", hiddenData(0));
    state.obj.a = 2;
    assert.deepEqual(countLooks(() => {
      for (let i = 0; i < 10; i++) state.obj.a = 3 + i;
      state.obj.h = 1;
    }), { descriptors: 0, keyLists: 0 });
    delete state.obj.h;
    assert.deepEqual(countLooks(() => {
      state.obj.a = 20;
    }), { descriptors: 0, keyLists: 0 });
    assert.equal(events.length, 12);
  };

  // The hidden keys an object proxy keeps follow its deletes and defines.
  cases["a hidden key deleted and written again by = is shown, on objects and arrays"] = () => {
    const { state, remote, events } = setup(lib);
    for (const container of [state.obj, state.list]) {
      container.a = 5;
      Object.defineProperty(container, "h", hiddenData(1));
      container.h = 2;
      delete container.h;
      container.h = 3;
      container.h = 4;
      Object.defineProperty(container, "h", { enumerable: false });
      container.h = 5;
      Object.defineProperty(container, "h", { enumerable: true });
      container.h = 6;
    }
    assert.deepEqual(events, [
      "set obj.a 5", "set obj.h 3", "set obj.h 4", "delete obj.h", "set obj.h 5", "set obj.h 6",
      "set list.a 5", "set list.h 3", "set list.h 4", "delete list.h", "set list.h 5", "set list.h 6",
    ]);
    sameJson(lib, remote, state);
  };

  cases["a define of a new enumerable key does not make the next write look at the keys again"] = () => {
    const { state } = setup(lib, { obj: { a: 1 } });
    state.obj.a = 2;
    assert.deepEqual(countLooks(() => {
      for (let i = 0; i < 5; i++) {
        Object.defineProperty(state.obj, `z${i}`, { value: i, enumerable: true, writable: true, configurable: true });
        state.obj.a = 3 + i;
      }
    }), { descriptors: 0, keyLists: 0 });
  };

  // Test gap: the array-define case added `enumerable: true` and lost this.
  cases["a hidden accessor made data by writable alone sends nothing and reruns its readers"] = () => {
    const { state, remote, events } = setup(lib);
    const accessor = { get: () => 1, set: () => {}, enumerable: false, configurable: true };
    Object.defineProperty(toRaw(state.obj), "acc", accessor);
    Object.defineProperty(toRaw(state.list), "acc", accessor);
    const effects = watch(lib, [() => state.obj.acc, () => state.list.acc]);
    Object.defineProperty(state.obj, "acc", { writable: true });
    Object.defineProperty(state.list, "acc", { writable: true });
    effects.stop();
    assert.deepEqual(events, []);
    assert.deepEqual(effects.runs, [2, 2]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(toRaw(state.obj), "acc"), { value: undefined, writable: true, enumerable: false, configurable: true });
    assert.deepEqual(Object.getOwnPropertyDescriptor(toRaw(state.list), "acc"), { value: undefined, writable: true, enumerable: false, configurable: true });
    sameJson(lib, remote, state);
  };

  // Test gap: an outer proxy whose `defineProperty` trap adds
  // `enumerable: false` on the way.
  cases["an outer proxy that hides the key on the way: a new key sends nothing, a shown key sends delete"] = () => {
    const { state, remote, events } = setup(lib);
    const hiding = (target) =>
      new Proxy(target, { defineProperty: (target, key, descriptor) => Reflect.defineProperty(target, key, { ...descriptor, enumerable: false }) });
    const effects = watch(lib, [() => state.obj.fresh, () => state.obj.a]);
    hiding(state.obj).fresh = 1;
    hiding(state.obj).a = 5;
    hiding(state.obj).fresh = 2;
    effects.stop();
    assert.deepEqual(events, ["delete obj.a"]);
    assert.deepEqual(effects.runs, [4, 3]);
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(state.obj), "fresh").enumerable, false);
    assert.deepEqual([toRaw(state.obj).fresh, toRaw(state.obj).a], [2, 5]);
    sameJson(lib, remote, state);
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = review317Cases(await import(pathToFileURL(resolve(process.argv[2])).href));
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
