// The cases the 3.0.16 review asked for (3.0.17): hidden keys stay off
// replicas, every trap of a receiver runs on every write, a fixed define of
// a proxy is refused before it writes, and a define calls no getter. Run by
// Bun (tests/review-316.bun.test.ts) and by Node on a bundle of the current
// source: node tests/review-316.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * A root `{ obj, list, other }` with a replica fed by its events (each
 * crosses a wire), an effect per entry of `reads` (each reads its keys of
 * `obj`, or of `list` for keys that start with "list."), and the events.
 */
function setup(lib, raw = {}) {
  const { reactive, updateState } = lib;
  const source = { obj: { a: 1, b: { n: 1 } }, list: [1, 2], other: { n: 2 }, ...raw };
  const remote = structuredClone(source);
  const events = [];
  const state = reactive(source, (event) => {
    const wire = structuredClone(event);
    events.push(`${wire.action} ${wire.path.join(".")}${"newValue" in wire ? " " + JSON.stringify(wire.newValue) : ""}`);
    updateState(remote, wire);
  });
  events.length = 0;
  return { state, remote, events };
}

/** How often each effect ran: one per entry of `reads`, reading those keys of `container()`. */
function watch(lib, container, reads) {
  const runs = reads.map(() => 0);
  const stops = reads.map((keys, i) =>
    lib.watchEffect(() => {
      runs[i]++;
      for (const key of keys) container()[key];
    })
  );
  return { runs, stop: () => stops.forEach((stop) => stop()) };
}

/** JSON of a replica and of its source, keys sorted: what a wire carries. Equal when the replica holds what the source shows. */
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

/** An outer proxy as a membrane makes it: it hides the prototype and copies descriptors. */
function membrane(target, log) {
  return new Proxy(target, {
    getPrototypeOf: () => null,
    getOwnPropertyDescriptor(target, key) {
      log?.push(`gopd ${String(key)}`);
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return descriptor && { ...descriptor };
    },
  });
}

/** `{ name: check }` for the library `lib`. */
export function review316Cases(lib) {
  const { toRaw, markRaw } = lib;
  const cases = {};

  // F1. A replica holds the enumerable keys alone, as JSON and spread do.
  // 3.0.16 sent `set` for a define that kept a key hidden, and the replica
  // got a key the object hides.
  cases["markRaw on a reactive child sends nothing, and replica JSON equals source JSON"] = () => {
    const { state, remote, events } = setup(lib);
    markRaw(state.obj);
    markRaw(state.list);
    assert.deepEqual(events, []);
    assert.equal(toRaw(state.obj).__v_skip, true);
    assert.equal(toRaw(state.list).__v_skip, true);
    sameJson(lib, remote, state);
  };

  cases["a define of a new hidden key writes it and reruns its readers, with no event"] = () => {
    const { state, remote, events } = setup(lib);
    const effects = watch(lib, () => state.obj, [["_meta"], ["a"]]);
    Object.defineProperty(state.obj, "_meta", { value: { x: 1 }, enumerable: false, writable: true, configurable: true });
    Object.defineProperty(state.obj, "flag", { value: 1 });
    effects.stop();
    assert.deepEqual(events, []);
    assert.deepEqual(toRaw(state.obj)._meta, { x: 1 });
    assert.equal(toRaw(state.obj).flag, 1);
    // a new key reruns every reader of a key of the object
    assert.deepEqual(effects.runs, [3, 3]);
    sameJson(lib, remote, state);
  };

  cases["a key already hidden stays hidden on every write: a define, =, an outer proxy, a membrane"] = () => {
    const raw = Object.defineProperty({ a: 1 }, "h", { value: 1, writable: true, enumerable: false, configurable: true });
    const { state, remote, events } = setup(lib, { obj: raw });
    const effects = watch(lib, () => state.obj, [["h"]]);
    Object.defineProperty(state.obj, "h", { value: 2 });
    Object.defineProperty(state.obj, "h", { value: 3, enumerable: false });
    state.obj.h = 4;
    new Proxy(state.obj, {}).h = 5;
    membrane(state.obj).h = 6;
    Reflect.set(state.obj, "h", 7, new Proxy(state.obj, {}));
    effects.stop();
    assert.deepEqual(events, []);
    assert.deepEqual(Object.getOwnPropertyDescriptor(toRaw(state.obj), "h"), { value: 7, writable: true, enumerable: false, configurable: true });
    assert.deepEqual(effects.runs, [7]);
    sameJson(lib, remote, state);
  };

  cases["a define that hides an enumerable key sends delete, and one that shows it sends set"] = () => {
    const { state, remote, events } = setup(lib, { obj: { a: 1, b: 2, c: { n: 3 } } });
    const effects = watch(lib, () => state.obj, [["a"], ["c"]]);
    Object.defineProperty(state.obj, "a", { value: 5, enumerable: false });
    Object.defineProperty(state.obj, "b", { enumerable: false });
    sameJson(lib, remote, state);
    Object.defineProperty(state.obj, "c", { enumerable: false });
    Object.defineProperty(state.obj, "c", { enumerable: true });
    Object.defineProperty(state.obj, "a", { value: 6, enumerable: true });
    Object.defineProperty(state.obj, "b", { enumerable: true });
    effects.stop();
    assert.deepEqual(events, ["delete obj.a", "delete obj.b", "delete obj.c", 'set obj.c {"n":3}', "set obj.a 6", "set obj.b 2"]);
    // a key shown or hidden reruns every reader of a key of the object
    assert.deepEqual(effects.runs, [7, 7]);
    assert.deepEqual(toRaw(state.obj), { a: 6, b: 2, c: { n: 3 } });
    sameJson(lib, remote, state);
    // the object shown again keeps its place: a write inside it is sent
    state.obj.c.n = 4;
    assert.equal(events.at(-1), "set obj.c.n 4");
    sameJson(lib, remote, state);
  };

  cases["a delete of a hidden key sends nothing and reruns its readers"] = () => {
    const raw = Object.defineProperty({ a: 1 }, "h", { value: 1, writable: true, enumerable: false, configurable: true });
    const { state, remote, events } = setup(lib, { obj: raw });
    const effects = watch(lib, () => state.obj, [["h"]]);
    assert.equal(delete state.obj.h, true);
    effects.stop();
    assert.deepEqual([events, effects.runs, "h" in toRaw(state.obj)], [[], [2], false]);
    sameJson(lib, remote, state);
  };

  cases["an array's hidden name stays off the replica; an index is sent whatever its flags"] = () => {
    const { state, remote, events } = setup(lib, { list: Object.assign([1, 2], { shown: 1 }) });
    const list = state.list;
    const effects = watch(lib, () => list, [["meta"], ["0"]]);
    Object.defineProperty(list, "meta", { value: { x: 1 }, enumerable: false, writable: true, configurable: true });
    list.meta = 2;
    Object.defineProperty(list, "shown", { enumerable: false });
    Object.defineProperty(list, "shown", { value: 3, enumerable: true });
    Object.defineProperty(list, "0", { value: 9, enumerable: false });
    Object.defineProperty(list, "1", { enumerable: false });
    assert.equal(delete list.meta, true);
    effects.stop();
    assert.deepEqual(events, ["delete list.shown", "set list.shown 3", "set list.0 9"]);
    assert.deepEqual(effects.runs, [4, 2]);
    assert.deepEqual([...toRaw(list)], [9, 2]);
    assert.deepEqual([remote.list.shown, [...remote.list]], [3, [9, 2]]);
    assert.equal(Object.keys(remote.list).includes("meta"), false);
  };

  // F2 and F3. Every trap of a receiver runs on every write, as on a plain
  // object. 3.0.16 remembered an outer proxy per key after its first write
  // and skipped its getOwnPropertyDescriptor and defineProperty traps.
  cases["a value-dependent defineProperty trap of an outer proxy decides every write, as on a plain object"] = () => {
    const run = (target) => {
      const log = [];
      const outer = new Proxy(target, {
        getOwnPropertyDescriptor(target, key) {
          log.push("gopd");
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        defineProperty(target, key, descriptor) {
          log.push("define");
          return !(descriptor.value < 0) && Reflect.defineProperty(target, key, descriptor);
        },
      });
      return { results: [2, 3, -1, 4].map((value) => Reflect.set(outer, "a", value)), log };
    };
    const { state, events } = setup(lib);
    const plain = run({ a: 1 });
    const proxied = run(state.obj);
    assert.deepEqual(proxied, plain);
    assert.deepEqual(plain.results, [true, true, false, true]);
    assert.deepEqual(events, ["set obj.a 2", "set obj.a 3", "set obj.a 4"]);
    assert.equal(toRaw(state.obj).a, 4);
  };

  cases["an outer proxy of an outer proxy with traps runs the same traps on every write as on a plain object"] = () => {
    const run = (target) => {
      const log = [];
      const traps = (name) => ({
        getOwnPropertyDescriptor(target, key) {
          log.push(`${name} gopd ${String(key)}`);
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        defineProperty(target, key, descriptor) {
          log.push(`${name} define ${String(key)}`);
          return Reflect.defineProperty(target, key, descriptor);
        },
      });
      const inner = new Proxy(target, traps("inner"));
      const outer = new Proxy(inner, traps("outer"));
      outer.a = 2;
      outer.a = 3;
      outer.z = 1;
      outer.z = 2;
      return log;
    };
    const { state, events } = setup(lib);
    assert.deepEqual(run(state.obj), run({ a: 1 }));
    assert.deepEqual(events, ["set obj.a 2", "set obj.a 3", "set obj.z 1", "set obj.z 2"]);
  };

  cases["a membrane's traps run on every write of a key, also after it was deleted and added again"] = () => {
    const run = (target) => {
      const log = [];
      const wrapped = membrane(target, log);
      for (let i = 0; i < 3; i++) {
        wrapped.k = i;
        delete wrapped.k;
        wrapped.k = i + 10;
      }
      return log;
    };
    const { state, events } = setup(lib);
    assert.deepEqual(run(state.obj), run({ a: 1 }));
    assert.equal(events.length, 9);
  };

  // F4. The engine checks that a fixed key holds the value the caller
  // defined. A proxy is stored as its raw object, so such a define cannot
  // succeed: it is refused before it writes. 3.0.16 wrote the state, sent
  // the event, and then the engine threw.
  cases["a fixed define of a proxy is refused before any write, event or rerun, on objects and arrays"] = () => {
    const { state, remote, events } = setup(lib, { obj: { a: 1, k: null } });
    const effects = watch(lib, () => state.obj, [["k", "n"]]);
    const fixed = { value: state.other, writable: false, configurable: false };
    assert.throws(() => Object.defineProperty(state.obj, "k", fixed), TypeError);
    assert.equal(Reflect.defineProperty(state.obj, "n", fixed), false);
    assert.equal(Reflect.defineProperty(state.obj, "m", { value: state.other }), false);
    assert.equal(Reflect.defineProperty(state.list, "0", fixed), false);
    assert.equal(Reflect.defineProperty(state.list, "name", fixed), false);
    effects.stop();
    assert.deepEqual([events, effects.runs], [[], [1]]);
    assert.deepEqual(toRaw(state.obj), { a: 1, k: null });
    assert.deepEqual([...toRaw(state.list)], [1, 2]);
    assert.equal(Object.keys(toRaw(state.list)).length, 2);
    sameJson(lib, remote, state);
  };

  cases["a fixed define of the proxy of the object a key holds is refused; a writable one succeeds"] = () => {
    const { state, events } = setup(lib, { obj: { a: 1 } });
    const held = toRaw(state.other);
    state.obj.k = state.other;
    events.length = 0;
    assert.equal(Reflect.defineProperty(state.obj, "k", { value: state.other, writable: false, configurable: false }), false);
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(state.obj), "k").writable, true);
    assert.equal(Reflect.defineProperty(state.obj, "k", { value: state.other, writable: false }), true);
    assert.equal(toRaw(state.obj).k, held);
    assert.deepEqual(events, []);
  };

  cases["a fixed define of a deep-equal object or of -0 stores the defined value, as on a plain object"] = () => {
    const { state, remote, events } = setup(lib, { obj: { a: 0, b: { n: 1 } }, list: [0, { n: 1 }] });
    const object = { n: 1 };
    Object.defineProperty(state.obj, "b", { value: object, writable: false, configurable: false });
    Object.defineProperty(state.obj, "a", { value: -0, writable: false, configurable: false });
    assert.equal(toRaw(state.obj).b, object);
    assert.equal(Object.is(toRaw(state.obj).a, -0), true);
    const item = { n: 1 };
    Object.defineProperty(state.list, "0", { value: -0, writable: false, configurable: false });
    Object.defineProperty(state.list, "1", { value: item, writable: false, configurable: false });
    assert.equal(Object.is(toRaw(state.list)[0], -0), true);
    assert.equal(toRaw(state.list)[1], item);
    assert.deepEqual(events, ['set obj.b {"n":1}', "set obj.a 0", "set list.0 0", 'set list.1 {"n":1}']);
    sameJson(lib, remote, state);
  };

  // A define calls no getter, as `Object.defineProperty` does not.
  cases["a value define over an own accessor whose getter throws defines it and calls no getter"] = () => {
    let reads = 0;
    let armed = false;
    const accessor = { get: () => (armed ? (reads++, assert.fail("getter called")) : 0), configurable: true, enumerable: true };
    const { state, remote, events } = setup(lib, {
      obj: Object.defineProperty({ a: 1 }, "acc", accessor),
      list: Object.defineProperty([1], "acc", accessor),
    });
    armed = true;
    Object.defineProperty(state.obj, "acc", { value: 2 });
    Object.defineProperty(state.list, "acc", { value: 3 });
    Object.defineProperty(state.obj, "acc", { value: 2 });
    assert.deepEqual([events, reads], [["set obj.acc 2", "set list.acc 3"], 0]);
    assert.equal(remote.obj.acc, 2);
    assert.equal(remote.list.acc, 3);
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = review316Cases(await import(pathToFileURL(resolve(process.argv[2])).href));
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
