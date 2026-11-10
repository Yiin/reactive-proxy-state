// The cases the 3.0.18 review asked for (3.0.19): `detachedWrites` counts a
// write whose object is in no tree, and only such a write; a replica holds
// no symbol key, as JSON; a write inside an object an array name holds is
// sent on its other places alone; the scope rule when the scope's path is
// hidden; one look at the keys after the last accessor goes; and the cases
// the review found untested. Run by Bun (tests/review-318.bun.test.ts) and
// by Node on a bundle of the current source:
// node tests/review-318.cases.mjs <bundle>
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
  const payloads = [];
  const warnings = [];
  const state = reactive(source, (event) => {
    payloads.push(event);
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
  return { state, remote, events, payloads, warnings };
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

/** How many writes `body` adds to `getProxyStats().detachedWrites`. */
function detached(lib, body) {
  const before = lib.getProxyStats().detachedWrites;
  body();
  return lib.getProxyStats().detachedWrites - before;
}

/** Counts the descriptor reads `body` makes. */
function descriptorReads(body) {
  const descriptor = Reflect.getOwnPropertyDescriptor;
  let count = 0;
  Reflect.getOwnPropertyDescriptor = (target, key) => {
    count++;
    return descriptor(target, key);
  };
  try {
    body();
  } finally {
    Reflect.getOwnPropertyDescriptor = descriptor;
  }
  return count;
}

/** Does `value`, or any object below it, have a symbol key? */
function holdsSymbol(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Object.getOwnPropertySymbols(value).length > 0) return true;
  const entries = value instanceof Map ? [...value.keys(), ...value.values()] : value instanceof Set ? [...value] : [];
  return [...entries, ...Object.values(value)].some((entry) => holdsSymbol(entry, seen));
}

const hiddenData = (value) => ({ value, writable: true, enumerable: false, configurable: true });

/** A chain `{ child: { child: ... value } }` of `depth` levels. */
function chainOf(depth, value) {
  let top = value;
  for (let i = 0; i < depth; i++) top = { child: top };
  return top;
}

/** `{ name: check }` for the library `lib`. */
export function review318Cases(lib) {
  const { toRaw } = lib;
  const cases = {};

  // F1: 3.0.18 counted a write under a hidden key as detached, and no
  // longer counted a hidden-key write on an object that left the tree.
  cases["writes inside an object only a hidden key holds are not detached writes"] = () => {
    const { state, events } = setup(lib);
    Object.defineProperty(state.obj, "h", hiddenData({ n: 1, deep: { m: 1 } }));
    const count = detached(lib, () => {
      for (let i = 0; i < 5; i++) state.obj.h.n = i;
      state.obj.h.deep.m = 2;
    });
    assert.deepEqual([count, events], [0, []]);
  };

  cases["a hidden-key write on an object that left the tree is a detached write"] = () => {
    const { state, events } = setup(lib);
    Object.defineProperty(state.obj.b, "h", hiddenData(1));
    const b = state.obj.b;
    // in the tree: not detached
    assert.equal(detached(lib, () => (b.h = 2)), 0);
    delete state.obj.b;
    events.length = 0;
    assert.equal(detached(lib, () => (b.h = 3)), 1);
    // a new symbol key is hidden too
    assert.equal(detached(lib, () => (b[Symbol("s")] = 1)), 1);
    assert.deepEqual(events, []);
  };

  cases["a write inside a hidden-held object that left the tree is a detached write"] = () => {
    const { state, events } = setup(lib);
    Object.defineProperty(state.obj.b, "h", hiddenData({ n: 1 }));
    const inner = state.obj.b.h;
    delete state.obj.b;
    events.length = 0;
    assert.equal(detached(lib, () => (inner.n = 2)), 1);
    assert.deepEqual(events, []);
  };

  cases["an object two hidden keys hold is in the tree: its writes are not detached writes"] = () => {
    const { state, events } = setup(lib);
    const shared = { n: 1 };
    Object.defineProperty(state.obj, "h1", hiddenData(shared));
    Object.defineProperty(state.obj.b, "h2", hiddenData(shared));
    const proxy = state.obj.h1;
    assert.equal(detached(lib, () => (proxy.n = 2)), 0);
    assert.deepEqual(events, []);
    // both holders left: a write through the proxy read before is detached
    delete state.obj.b;
    delete state.obj.h1;
    events.length = 0;
    assert.equal(detached(lib, () => (proxy.n = 3)), 1);
    assert.deepEqual(events, []);
  };

  cases["a hidden ancestor deeper than the fast walk sends nothing and is not detached"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    Object.defineProperty(state.obj, "h", hiddenData(chainOf(300, { n: 1 })));
    let deep = state.obj.h;
    for (let i = 0; i < 300; i++) deep = deep.child;
    assert.equal(detached(lib, () => (deep.n = 2)), 0);
    assert.deepEqual([events, warnings], [[], []]);
    // shown, the same write is sent with its full path
    Object.defineProperty(state.obj, "h", { enumerable: true });
    events.length = 0;
    deep.n = 3;
    assert.equal(events.length, 1);
    assert.equal(events[0], `set obj.h.${Array(300).fill("child").join(".")}.n 3`);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
  };

  // F2: an enumerable symbol key reached the replica as the string key
  // "Symbol(s)". A replica holds what JSON holds: no symbol key.
  cases["an enumerable symbol key sends nothing: =, define, delete and writes inside, and reruns its readers"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    const s = Symbol("s");
    const effects = watch(lib, [() => state.obj[s], () => state.obj[s]?.n]);
    state.obj[s] = { n: 1 };
    state.obj[s].n = 2;
    state.obj[s].deep = { m: 1 };
    state.obj[s].deep.m = 2;
    Object.defineProperty(state.obj, s, { value: { n: 5 }, writable: true, enumerable: true, configurable: true });
    state.obj[s].n = 6;
    delete state.obj[s];
    effects.stop();
    assert.deepEqual([events, warnings], [[], []]);
    // the second reads a key of the object: a key added inside reruns it too
    assert.deepEqual(effects.runs, [4, 7]);
    assert.equal(Object.hasOwn(toRaw(state.obj), s), false);
    sameJson(lib, remote, state);
    assert.equal(Object.hasOwn(remote.obj, "Symbol(s)"), false);
  };

  cases["a symbol name of an array sends nothing"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    const s = Symbol("s");
    state.list[s] = { n: 1 };
    state.list[s].n = 2;
    delete state.list[s];
    state.list.push(3);
    assert.deepEqual(events, ["array-push list"]);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
  };

  cases["payload copies hold no symbol key: the initial replace, a set, a push and a removed value"] = () => {
    const s = Symbol("s");
    const withSymbol = () => {
      const value = { a: 1, [s]: { hidden: 1 } };
      const list = [1];
      list[s] = { n: 1 };
      value.list = list;
      value.map = new Map([["k", { [s]: 1 }]]);
      return value;
    };
    const { state, payloads } = setup(lib, { start: withSymbol() });
    const initial = payloads.length;
    state.obj.c = withSymbol();
    state.list.push(withSymbol());
    state.rows.splice(0, 1, withSymbol());
    const async = [];
    const queued = lib.reactive({ obj: { c: withSymbol() } }, (event) => async.push(event), [], { async: true });
    delete queued.obj.c;
    assert.equal(initial, 1);
    for (const payload of payloads) assert.equal(holdsSymbol(payload.newValue) || holdsSymbol(payload.items), false, JSON.stringify(payload.path));
    return Promise.resolve().then(() => {
      assert.equal(async.length, 2);
      for (const payload of async) assert.equal(holdsSymbol(payload.newValue) || holdsSymbol(payload.oldValue), false);
    });
  };

  cases["an object a symbol key and a string key hold sends each write once, on the string path"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    state.obj[Symbol("ref")] = state.other;
    events.length = 0;
    state.other.n = 3;
    assert.deepEqual(events, ["set other.n 3"]);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
  };

  cases["a symbol name an array already has sends nothing, after the array looked at its keys"] = () => {
    const { state, remote, events, warnings } = setup(lib, { tagged: Object.assign([1], { label: "x" }) });
    const s = Symbol("s");
    // a write of a name the array has makes it look at its keys
    state.tagged.label = "y";
    events.length = 0;
    state.tagged[s] = 1;
    state.tagged[s] = 2;
    delete state.tagged[s];
    assert.deepEqual([events, warnings], [[], []]);
    sameJson(lib, remote, state);
  };

  cases["an accessor defined at a symbol key is hidden: a write inside its object sends nothing"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    const s = Symbol("s");
    const inner = { n: 1 };
    // the object looks at its keys at its first write
    state.obj.a = 2;
    events.length = 0;
    Object.defineProperty(state.obj, s, { get: () => inner, enumerable: true, configurable: true });
    state.obj[s].n = 2;
    assert.deepEqual([events, warnings], [[], []]);
    assert.equal(inner.n, 2);
    sameJson(lib, remote, state);
  };

  cases["a hidden symbol key sends nothing"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    const s = Symbol("hidden");
    Object.defineProperty(state.obj, s, hiddenData({ n: 1 }));
    state.obj[s].n = 2;
    state.obj[s] = 3;
    assert.deepEqual([events, warnings], [[], []]);
    sameJson(lib, remote, state);
  };

  // F3: an object at an array name and at a key sent its writes on both
  // paths; a replica built from JSON has no names and warned.
  cases["an object an array name and a key hold sends each write on the key path alone"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    state.list.meta = state.other;
    events.length = 0;
    state.other.n = 3;
    state.other.deep = { k: 1 };
    state.other.deep.k = 2;
    assert.deepEqual(events, ["set other.n 3", 'set other.deep {"k":1}', "set other.deep.k 2"]);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
    // the name itself is still written with its path
    state.list.meta = 1;
    assert.equal(events.at(-1), "set list.meta 1");
  };

  cases["an object a numeric-looking array name holds reads as an item and is sent there"] = () => {
    const { state, events } = setup(lib, { list: Object.assign([1], { "01": { n: 1 } }) });
    state.list["01"].n = 2;
    assert.deepEqual(events, ["set list.01.n 2"]);
  };

  // F4: the scope rule picks among the roots with a sent path.
  cases["two roots: a hidden scope path sends to the other root, like a deleted one; shown again, to the scope"] = () => {
    for (const how of ["hide", "delete"]) {
      const x = { n: 1 };
      const a = [];
      const b = [];
      const A = lib.reactive({ v: x }, (event) => a.push(`${event.action} ${event.path.join(".")}`));
      const B = lib.reactive({ w: x }, (event) => b.push(`${event.action} ${event.path.join(".")}`));
      // A is the scope: it was read first
      A.v.n;
      B.w.n;
      a.length = 0;
      b.length = 0;
      B.w.n = 2;
      assert.deepEqual([a, b], [["set v.n"], []]);
      if (how === "hide") Object.defineProperty(A, "v", { enumerable: false });
      else delete A.v;
      a.length = 0;
      const count = detached(lib, () => {
        B.w.n = 3;
        if (how === "hide") A.v.n = 4;
      });
      assert.deepEqual([a, b, count], [[], how === "hide" ? ["set w.n", "set w.n"] : ["set w.n"], 0], how);
      if (how === "hide") {
        Object.defineProperty(A, "v", { enumerable: true });
        a.length = 0;
        b.length = 0;
        B.w.n = 5;
        assert.deepEqual([a, b], [["set v.n"], []]);
      }
    }
  };

  // F5: 3.0.18 read a descriptor per write after the last accessor went.
  cases["an object whose last accessor went reads no descriptor per write after one look"] = () => {
    const accessor = { get: () => 1, set: () => {}, enumerable: true, configurable: true };
    // objects and arrays; the accessor goes by delete, by a define with a value, or by `writable` alone
    for (const kind of ["object", "array"]) {
      for (const how of ["delete", "value", "writable"]) {
        const { state } = setup(lib, { tagged: Object.assign([1], { label: 0 }) });
        const target = kind === "object" ? state.obj : state.tagged;
        const key = kind === "object" ? "a" : "label";
        Object.defineProperty(target, "g", accessor);
        target[key] = 2;
        if (how === "delete") delete target.g;
        else if (how === "value") Object.defineProperty(target, "g", { value: 1, writable: true, enumerable: true, configurable: true });
        else Object.defineProperty(target, "g", { writable: true });
        target[key] = 3;
        assert.equal(descriptorReads(() => {
          target[key] = 4;
          target[key] = 5;
        }), 0, `${kind} ${how}`);
      }
    }
  };

  // Gaps the review listed: a Map and a Set under a hidden key, a parent
  // with more than 64 keys, a hidden key on the root.
  cases["a Map and a Set under a hidden key send nothing and rerun their readers"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    Object.defineProperty(state.obj, "m", hiddenData(new Map([["k", { n: 1 }]])));
    Object.defineProperty(state.obj, "s", hiddenData(new Set([1])));
    const effects = watch(lib, [() => state.obj.m.get("k").n, () => state.obj.s.has(2)]);
    state.obj.m.get("k").n = 2;
    state.obj.m.set("j", { n: 1 });
    state.obj.m.delete("j");
    state.obj.s.add(2);
    state.obj.s.delete(1);
    effects.stop();
    assert.deepEqual([events, warnings], [[], []]);
    assert.deepEqual(effects.runs, [2, 2]);
    assert.equal(detached(lib, () => state.obj.m.set("x", 1)), 0);
    sameJson(lib, remote, state);
  };

  cases["a parent with more than 64 keys and a hidden key: writes inside its child send nothing"] = () => {
    const wide = {};
    for (let i = 0; i < 80; i++) wide["k" + i] = i;
    Object.defineProperty(wide, "h", hiddenData({ n: 1 }));
    wide.v = { n: 1 };
    const t = Symbol("t");
    wide[t] = { n: 1 };
    const { state, remote, events, warnings } = setup(lib, { wide });
    state.wide.h.n = 2;
    state.wide.v.n = 2;
    state.wide[Symbol("s")] = { n: 1 };
    // a symbol key the object had at its first look
    state.wide[t].n = 2;
    state.wide.k1 = 5;
    assert.deepEqual(events, ["set wide.v.n 2", "set wide.k1 5"]);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
  };

  cases["a hidden key on the root sends nothing, also for writes inside its object"] = () => {
    const { state, remote, events, warnings } = setup(lib);
    Object.defineProperty(state, "h", hiddenData({ n: 1 }));
    state.h.n = 2;
    state.h = { n: 3 };
    state.h.n = 4;
    state.obj.a = 2;
    assert.deepEqual(events, ["set obj.a 2"]);
    assert.deepEqual(warnings, []);
    sameJson(lib, remote, state);
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = review318Cases(await import(pathToFileURL(resolve(process.argv[2])).href));
  for (const [name, check] of Object.entries(cases)) {
    try {
      await check();
    } catch (error) {
      console.error(`failed: ${name}`);
      throw error;
    }
  }
  console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? "node" : "bun", passed: Object.keys(cases).length }));
}
