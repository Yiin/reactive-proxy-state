// 3.0.20 shares the write traps of object and array proxies: each trap finds
// the proxy's node, options, proxy and method cache in its handler, and one
// module slot carries a define's descriptor to `set`. These cases pin that
// every proxy still writes as its own: its own paths, its own root's
// options, its own reorder results and method cache, and no descriptor left
// over for the next write. 3.0.19 passes them all. Run by Bun
// (tests/shared-traps.bun.test.ts) and by Node on a bundle of the current
// source: node tests/shared-traps.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** A root over `raw` with its events as `action path` lines. */
function root(lib, raw, options) {
  const events = [];
  const state = lib.reactive(
    raw,
    (event) => events.push(`${event.action} ${event.path.join(".")}`),
    [],
    options
  );
  events.length = 0; // the initial replace
  return { state, events };
}

export function sharedTrapCases(lib) {
  const { toRaw } = lib;
  const cases = {};

  cases["each array's reorders give its own proxy"] = () => {
    const { state } = root(lib, { a: [2, 1], b: [4, 3], c: [1, 2] });
    // the first array makes its wrappers first
    assert.equal(state.a.sort(), state.a);
    assert.equal(state.b.sort(), state.b);
    assert.equal(state.b.reverse(), state.b);
    assert.equal(state.b.fill(0), state.b);
    assert.equal(state.b.copyWithin(0, 1), state.b);
    // a reorder that changes nothing gives the proxy too
    assert.equal(state.c.sort(), state.c);
    assert.deepEqual(toRaw(state.b), [0, 0]);
  };

  cases["writes through two object proxies are sent on their own paths"] = () => {
    const { state, events } = root(lib, { a: { x: 1 }, b: { x: 1 }, list: [{ n: 1 }, { n: 2 }] });
    const { a, b } = state;
    const [first, second] = state.list;
    b.x = 2;
    a.x = 3;
    delete b.x;
    Object.defineProperty(a, "y", { value: 4, enumerable: true, writable: true, configurable: true });
    second.n = 5;
    first.n = 6;
    assert.deepEqual(events, ["set b.x", "set a.x", "delete b.x", "set a.y", "set list.1.n", "set list.0.n"]);
  };

  cases["each array proxy writes on its own path"] = () => {
    const { state, events } = root(lib, { a: [1], b: [1] });
    const { a, b } = state;
    b[0] = 2;
    a.push(3);
    b.push(4);
    a.length = 1;
    Object.defineProperty(b, "0", { value: 7, enumerable: true, writable: true, configurable: true });
    assert.deepEqual(events, ["set b.0", "array-push a", "array-push b", "set a.length", "set b.0"]);
  };

  cases["a define leaves no descriptor for the next write"] = () => {
    const { state, events } = root(lib, { a: { x: 1 }, b: { y: 1 }, list: [1], other: [1] });
    // the define hides `x`: a delete on the replica
    Object.defineProperty(state.a, "x", { value: 2, enumerable: false });
    // a plain write of another proxy is a plain write: sent, and `y` stays enumerable
    state.b.y = 3;
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(state.b), "y").enumerable, true);
    Object.defineProperty(state.list, "name", { value: "n", enumerable: false });
    state.other.label = "l";
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(state.other), "label").enumerable, true);
    assert.deepEqual(events, ["delete a.x", "set b.y", "set other.label"]);
  };

  cases["a refused define leaves no descriptor for the next write"] = () => {
    const { state, events } = root(lib, { a: { child: { n: 1 } }, b: { y: 1 } });
    const child = state.a.child;
    // a read-only, non-configurable key with a proxy as its value is refused before the write
    assert.throws(() => Object.defineProperty(state.a, "fixed", { value: child, writable: false, configurable: false }), TypeError);
    state.b.y = 2;
    assert.equal(Object.getOwnPropertyDescriptor(toRaw(state.b), "y").writable, true);
    assert.deepEqual(events, ["set b.y"]);
  };

  cases["each root's options reach its own writes"] = async () => {
    const sync = root(lib, { x: { n: 1 } });
    const deferred = root(lib, { x: { n: 1 } }, { async: true });
    await Promise.resolve();
    deferred.events.length = 0;
    // a synchronous root compares an equal object deeply and sends nothing
    sync.state.x = { n: 1 };
    // an async root skips the deep comparison and sends the write
    deferred.state.x = { n: 1 };
    await Promise.resolve();
    assert.deepEqual(sync.events, []);
    assert.deepEqual(deferred.events, ["set x"]);
  };

  cases["each array keeps its own method cache"] = () => {
    const { state } = root(lib, { a: [1], b: [1] });
    const pushA = state.a.push;
    const pushB = state.b.push;
    assert.notEqual(pushA, pushB);
    // an own `push` replaces the cached wrapper of that array alone
    const own = function () {
      return "own";
    };
    state.b.push = own;
    assert.equal(state.b.push(9), "own");
    assert.equal(state.a.push, pushA);
    delete state.b.push;
    assert.equal(state.b.push(2), 2);
    assert.deepEqual(toRaw(state.b), [1, 2]);
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = sharedTrapCases(await import(pathToFileURL(resolve(process.argv[2])).href));
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
