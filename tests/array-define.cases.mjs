// Writes that reach an array proxy through another receiver, and defines
// through it (3.0.13). Run by Bun (tests/array-define.bun.test.ts) and by
// Node on a bundle of the current source: node tests/array-define.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** `[events, runs]` of `body(list)` on a fresh `{ list: [1, 2] }`, with one effect reading `reads`. */
function record(lib, raw, reads, body) {
  const { reactive, watchEffect } = lib;
  const events = [];
  const state = reactive({ list: raw }, (event) =>
    events.push(`${event.action} ${event.path.join(".")} ${JSON.stringify(event.newValue)}`)
  );
  const list = state.list;
  let runs = 0;
  const stop = watchEffect(() => {
    runs++;
    for (const key of reads) list[key];
  });
  events.length = 0;
  try {
    body(list);
  } finally {
    stop();
  }
  return { events, runs };
}

/**
 * Ways to write `list[key] = value`: the proxy itself, and receivers that
 * forward to it, so the write lands on the array.
 */
const routes = {
  direct: (list, key, value) => (list[key] = value),
  "an outer proxy": (list, key, value) => (new Proxy(list, {})[key] = value),
  "an outer proxy of an outer proxy": (list, key, value) => (new Proxy(new Proxy(list, {}), {})[key] = value),
  "an outer proxy whose set trap forwards the receiver": (list, key, value) =>
    (new Proxy(list, { set: (target, key, value, receiver) => Reflect.set(target, key, value, receiver) })[key] = value),
  "Reflect.set with an outer proxy as receiver": (list, key, value) => Reflect.set(list, key, value, new Proxy(list, {})),
  "Reflect.set on an outer proxy": (list, key, value) => Reflect.set(new Proxy(list, {}), key, value),
};

/** `{ name: check }` for the library `lib`. */
export function arrayDefineCases(lib) {
  const { reactive, toRaw, watchEffect, updateState } = lib;
  const cases = {};

  // 3.0.12 handled such a write in the set trap and again in the
  // defineProperty trap the write reaches: two events, two reruns.
  const writes = [
    ["an index", 0, 9],
    ["a new index", 3, 7],
    ["a shorter length", "length", 1],
    ["a longer length", "length", 4],
    ["a name", "bar", 5],
    ["an object", 1, { n: 1 }],
  ];
  for (const [name, route] of Object.entries(routes)) {
    if (name === "direct") continue;
    cases[`a write through ${name} sends each event once and reruns each effect once`] = () => {
      for (const [what, key, value] of writes) {
        const reads = [0, 1, 3, "length", "bar"];
        const direct = record(lib, [1, 2], reads, (list) => routes.direct(list, key, value));
        const through = record(lib, [1, 2], reads, (list) => route(list, key, value));
        assert.deepEqual(through, direct, what);
        assert.equal(direct.runs, 2, what);
      }
    };
  }

  // A receiver that does not forward to the array gets the write, as on a
  // plain array. The array keeps its items: no event, no rerun. Until
  // 3.0.12 the array proxy sent an event for a write it did not make.
  cases["a write with a receiver that does not forward lands on the receiver and sends nothing"] = () => {
    const plain = {};
    let child;
    const result = record(lib, [1, 2], [0, "length"], (list) => {
      assert.equal(Reflect.set(list, 0, 9, plain), true);
      child = Object.create(list);
      child[1] = 8;
      child.length = 0;
    });
    assert.deepEqual(result, { events: [], runs: 1 });
    assert.deepEqual(plain, { 0: 9 });
    assert.deepEqual(Object.keys(child), ["1", "length"]);
    const native = Object.create([1, 2]);
    native[1] = 8;
    assert.deepEqual(Object.keys(native), ["1"]);
  };

  // A wrapper's own defineProperty trap decides, as for a plain array.
  cases["an outer proxy that refuses defineProperty: the write fails and sends nothing"] = () => {
    let raw;
    const result = record(lib, [1, 2], [0, "length"], (list) => {
      raw = toRaw(list);
      const readOnly = new Proxy(list, { defineProperty: () => false });
      assert.equal(Reflect.set(readOnly, 0, 9), false);
      assert.equal(Reflect.set(readOnly, "length", 0), false);
      // module code is strict: a refused write throws
      assert.throws(() => {
        readOnly[0] = 9;
      }, TypeError);
    });
    assert.deepEqual(result, { events: [], runs: 1 });
    assert.deepEqual(raw, [1, 2]);
  };

  // `Object.defineProperty` with flags alone on a key the array does not
  // have creates it, holding `undefined`: the write of `undefined`.
  // 3.0.12 created it and sent nothing.
  for (const [what, key] of [["index", "4"], ["name", "bar"]]) {
    cases[`flags alone on a new ${what} write undefined: the event of the write, and effects rerun`] = () => {
      const reads = [4, "length", "bar"];
      const descriptor = { writable: true, enumerable: true, configurable: true };
      const defined = record(lib, [1, 2], reads, (list) => assert.equal(Reflect.defineProperty(list, key, descriptor), true));
      const written = record(lib, [1, 2], reads, (list) => (list[key] = undefined));
      assert.deepEqual(defined, written);
      assert.equal(defined.runs, 2);
      assert.equal(defined.events.length, 1);
    };
  }

  cases["writable alone makes an own accessor a data property holding undefined: an event, and effects rerun"] = () => {
    const accessor = () => {
      const raw = [1];
      Object.defineProperty(raw, "bar", { get: () => 5, configurable: true });
      return raw;
    };
    const result = record(lib, accessor(), ["bar"], (list) => {
      assert.equal(list.bar, 5);
      Object.defineProperty(list, "bar", { writable: true });
      assert.equal(list.bar, undefined);
    });
    assert.deepEqual(result, { events: ["set list.bar undefined"], runs: 2 });
    // flags alone on an accessor without `writable` keep it an accessor
    let raw;
    const kept = record(lib, accessor(), ["bar"], (list) => {
      raw = toRaw(list);
      Object.defineProperty(list, "bar", { enumerable: true });
    });
    assert.deepEqual(kept, { events: [], runs: 1 });
    assert.equal(typeof Object.getOwnPropertyDescriptor(raw, "bar").get, "function");
  };

  // A setter along the prototype chain runs with the proxy as `this`, as an
  // own setter does: its writes send their events, and the write of the
  // setter's key itself sends none. 3.0.12 ran it on the raw array (no event
  // for its writes); 3.0.11 also sent the setter's key as a value.
  cases["a setter on a subclass prototype or Array.prototype runs with the proxy as this"] = () => {
    class Listed extends Array {
      set foo(value) {
        this.bar = value;
      }
    }
    for (const route of Object.values(routes)) {
      const result = record(lib, Listed.from([1, 2]), ["bar", "foo"], (list) => route(list, "foo", 7));
      assert.deepEqual(result, { events: ["set list.bar 7"], runs: 2 });
    }
    Object.defineProperty(Array.prototype, "baz", {
      set(value) {
        this.qux = value;
      },
      configurable: true,
    });
    try {
      const raw = [1];
      const result = record(lib, raw, ["qux"], (list) => (list.baz = 3));
      assert.deepEqual(result, { events: ["set list.qux 3"], runs: 2 });
      assert.equal(Object.getOwnPropertyDescriptor(raw, "qux").value, 3);
    } finally {
      delete Array.prototype.baz;
    }
  };

  // A write through an inherited setter reruns the readers of its key: the
  // getter can read what no proxy sees, such as a closure. 3.0.13 reran
  // them only when the setter wrote through the proxy. No event is sent for
  // the key, on any route.
  cases["a write through an inherited setter reruns the readers of its key, on every route"] = () => {
    let hidden = 1;
    class Hidden extends Array {
      get foo() {
        return hidden;
      }
      set foo(value) {
        hidden = value;
      }
    }
    for (const [name, route] of Object.entries(routes)) {
      hidden = 1;
      let seen;
      const result = record(lib, Hidden.from([1, 2]), ["foo"], (list) => {
        route(list, "foo", 7);
        seen = list.foo;
        // the same value reruns nothing, as for any write
        route(list, "foo", 7);
      });
      assert.deepEqual({ ...result, seen }, { events: [], runs: 2, seen: 7 }, name);
    }
  };

  cases["a setter that reads and writes through the proxy reruns each effect once per write"] = () => {
    class Mirror extends Array {
      get foo() {
        return this.bar;
      }
      set foo(value) {
        this.bar = value;
        this.baz = value;
      }
    }
    for (const [name, route] of Object.entries(routes)) {
      const result = record(lib, Mirror.from([1]), ["foo", "bar", "baz"], (list) => route(list, "foo", 4));
      assert.deepEqual(result, { events: ["set list.bar 4", "set list.baz 4"], runs: 2 }, name);
    }
    Object.defineProperty(Array.prototype, "hiddenOnArrays", {
      get() {
        return 5;
      },
      set(value) {
        this.qux = value;
      },
      configurable: true,
    });
    try {
      const result = record(lib, [1], ["hiddenOnArrays", "qux"], (list) => (list.hiddenOnArrays = 3));
      assert.deepEqual(result, { events: ["set list.qux 3"], runs: 2 });
    } finally {
      delete Array.prototype.hiddenOnArrays;
    }
  };

  // The getter decides that a write changes nothing, on every route, also
  // when it gives `undefined` for a key the setter would create. 3.0.13
  // ran an own setter for a write through another receiver.
  cases["an own setter acts on every route as on the proxy"] = () => {
    const owning = () => {
      const raw = [1];
      Object.defineProperty(raw, "foo", {
        get() {
          return this.bar;
        },
        set(value) {
          this.bar = value;
        },
        configurable: true,
      });
      return raw;
    };
    for (const [name, route] of Object.entries(routes)) {
      const same = record(lib, owning(), ["foo", "bar"], (list) => route(list, "foo", undefined));
      assert.deepEqual(same, { events: [], runs: 1 }, name);
      const changed = record(lib, owning(), ["foo", "bar"], (list) => route(list, "foo", 5));
      assert.deepEqual(changed, { events: ["set list.bar 5"], runs: 2 }, name);
    }
  };

  cases["an effect that writes an inherited accessor it reads runs once"] = () => {
    let hidden = 0;
    class Hidden extends Array {
      get foo() {
        return hidden;
      }
      set foo(value) {
        hidden = value;
      }
    }
    const state = reactive({ list: Hidden.from([1]) }, () => {});
    const list = state.list;
    let runs = 0;
    const stop = watchEffect(() => {
      runs++;
      list.foo = list.foo + 1;
    });
    assert.deepEqual({ runs, hidden }, { runs: 1, hidden: 1 });
    list.foo = 10;
    assert.deepEqual({ runs, hidden }, { runs: 2, hidden: 11 });
    stop();
  };

  // `__proto__` is the setter of Object.prototype: it changes the array's
  // prototype and sends no event, as any inherited setter. A replica cannot
  // apply a prototype. 3.0.11 and 3.0.12 sent `set list.__proto__`.
  cases["list.__proto__ = proto changes the array's prototype, sends no event, and reruns its readers"] = () => {
    const proto = Object.create(Array.prototype, { extra: { value: "from proto" } });
    let raw;
    let seen;
    const result = record(lib, [1, 2], [0, "length"], (list) => {
      raw = toRaw(list);
      let runs = 0;
      const stop = watchEffect(() => {
        runs++;
        seen = list.__proto__;
      });
      list.__proto__ = proto;
      assert.equal(runs, 2);
      stop();
    });
    assert.deepEqual(result, { events: [], runs: 1 });
    assert.equal(seen, proto);
    assert.equal(Object.getPrototypeOf(raw), proto);
    assert.equal(raw.extra, "from proto");
    assert.equal(Object.hasOwn(raw, "__proto__"), false);
  };

  // A non-extensible array refuses a new key: the define fails, as on a
  // plain array, and nothing is sent.
  cases["flags alone on a new key of a non-extensible array fail and send nothing"] = () => {
    const descriptor = { writable: true, enumerable: true, configurable: true };
    for (const key of ["4", "bar"]) {
      let raw;
      const result = record(lib, Object.preventExtensions([1, 2]), [4, "length", "bar"], (list) => {
        raw = toRaw(list);
        assert.equal(Reflect.defineProperty(list, key, descriptor), false);
        assert.throws(() => Object.defineProperty(list, key, descriptor), TypeError);
      });
      assert.deepEqual(result, { events: [], runs: 1 }, key);
      assert.deepEqual(Object.keys(raw), ["0", "1"], key);
    }
  };

  // The effect's own write does not rerun it, on any route.
  cases["an effect that writes what it reads through an outer proxy runs once per change"] = () => {
    for (const [name, route] of Object.entries(routes)) {
      const state = reactive({ list: [1, 2] }, () => {});
      const list = state.list;
      let runs = 0;
      const stop = watchEffect(() => {
        runs++;
        route(list, 0, list[0] + list[1]);
        route(list, "bar", (list.bar ?? 0) + 1);
      });
      assert.equal(runs, 1, name);
      assert.deepEqual([toRaw(list)[0], toRaw(list).bar], [3, 1], name);
      list[1] = 5;
      assert.equal(runs, 2, name);
      assert.deepEqual([toRaw(list)[0], toRaw(list).bar], [8, 2], name);
      stop();
    }
  };

  // The raw array as receiver is a write to the raw array: outside the
  // proxies, so nothing is sent (3.0.11 sent an event).
  cases["Reflect.set with the raw array as receiver writes the raw array and sends nothing"] = () => {
    let raw;
    const result = record(lib, [1, 2], [0, "length"], (list) => {
      raw = toRaw(list);
      assert.equal(Reflect.set(list, 0, 9, raw), true);
      assert.equal(Reflect.set(list, "length", 3, raw), true);
    });
    assert.deepEqual(result, { events: [], runs: 1 });
    assert.equal(raw[0], 9);
    assert.equal(raw.length, 3);
  };

  // A value written through an outer proxy is unwrapped once, where the
  // write lands, and stored raw. 3.0.13 unwrapped it twice.
  cases["an outer-proxy write of an array holding proxies stores it raw, unwrapped once"] = () => {
    const walks = (write) => {
      const state = reactive({ list: [1], other: [{ n: 1 }, { n: 2 }] }, () => {});
      let reads = 0;
      const counter = new Proxy(
        {},
        {
          get(target, key, receiver) {
            if (key === "__v_isReactive") reads++;
            return Reflect.get(target, key, receiver);
          },
        }
      );
      const value = [state.other[0], state.other[1], counter];
      write(state.list, value);
      const stored = toRaw(state.list)[0];
      assert.equal(stored, value);
      assert.equal(stored[0], toRaw(state.other)[0]);
      assert.equal(stored[1], toRaw(state.other)[1]);
      return reads;
    };
    const direct = walks((list, value) => (list[0] = value));
    for (const [name, route] of Object.entries(routes)) assert.equal(walks((list, value) => route(list, 0, value)), direct, name);
  };

  // The read that checks a kept reader is the read the trap returns.
  cases["a getter defined over a function read before runs once per read"] = () => {
    const state = reactive({ list: [1] }, () => {});
    const list = state.list;
    assert.equal(typeof list.hasOwnProperty, "function");
    let calls = 0;
    Object.defineProperty(list, "hasOwnProperty", {
      get() {
        calls++;
        return function own() {
          return "own";
        };
      },
      configurable: true,
    });
    calls = 0;
    assert.equal(list.hasOwnProperty(), "own");
    assert.equal(list.hasOwnProperty(), "own");
    assert.equal(calls, 2);
  };

  cases["Object.defineProperties through an array proxy sends one event per key, as the writes with ="] = () => {
    const reads = [0, 3, "length", "bar"];
    const defined = record(lib, [1, 2], reads, (list) =>
      Object.defineProperties(list, {
        0: { value: 5 },
        3: { value: 6, writable: true, enumerable: true, configurable: true },
        bar: { value: 7, writable: true, enumerable: true, configurable: true },
      })
    );
    const written = record(lib, [1, 2], reads, (list) => {
      list[0] = 5;
      list[3] = 6;
      list.bar = 7;
    });
    assert.deepEqual(defined.events, written.events);
    assert.deepEqual(defined.events, ["set list.0 5", "set list.3 6", "set list.bar 7"]);
    // one rerun per define, as per write
    assert.equal(defined.runs, written.runs);
  };

  // A replica that applies the events of defines holds what the array holds.
  cases["a replica built from define events matches the array: length grow and shrink, an index, a name"] = () => {
    const raw = { list: [1, { n: 2 }, 3] };
    const remote = structuredClone(raw);
    const state = reactive(raw, (event) => updateState(remote, structuredClone(event)));
    const list = state.list;
    const define = (key, value) =>
      Object.defineProperty(list, key, { value, writable: true, enumerable: true, configurable: true });
    const steps = [
      () => Object.defineProperty(list, "length", { value: 5 }),
      () => define("1", { n: 4 }),
      () => define("6", 7),
      () => define("bar", { deep: [1] }),
      () => Object.defineProperty(list, "length", { value: 2 }),
      () => Object.defineProperty(list, "4", { writable: true, enumerable: true, configurable: true }),
      () => Object.defineProperties(list, { 0: { value: 9 }, bar: { value: 8 } }),
    ];
    for (const step of steps) {
      step();
      const native = toRaw(list);
      assert.equal(remote.list.length, native.length);
      for (let i = 0; i < native.length; i++) assert.deepEqual(remote.list[i], native[i], String(i));
      assert.deepEqual(remote.list.bar, native.bar);
    }
  };

  cases["an effect that defines what it reads runs once"] = () => {
    const state = reactive({ list: [1, 2] }, () => {});
    const list = state.list;
    let runs = 0;
    const stop = watchEffect(() => {
      runs++;
      Object.defineProperty(list, "0", { value: list[0] + list.length });
      Object.defineProperty(list, "bar", { value: runs, writable: true, configurable: true });
      list.bar;
    });
    assert.equal(runs, 1);
    assert.equal(toRaw(list)[0], 3);
    list[1] = 5;
    assert.equal(runs, 1);
    list.length = 3;
    assert.equal(runs, 2);
    stop();
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = arrayDefineCases(await import(pathToFileURL(resolve(process.argv[2])).href));
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
