// Writes that reach an object proxy through another receiver, and defines
// through it (3.0.16), plus the setter cases the 3.0.15 review asked for.
// Run by Bun (tests/object-define.bun.test.ts) and by Node on a bundle of
// the current source: node tests/object-define.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * `{ events, runs, raw, state }` of `body(obj, state)` on `{ obj: raw, other: {} }`,
 * with one effect per entry of `reads` (each reads its keys of `obj`).
 */
function record(lib, raw, reads, body) {
  const { reactive, watchEffect, toRaw } = lib;
  const events = [];
  const state = reactive({ obj: raw, other: {} }, (event) =>
    events.push(`${event.action} ${event.path.join(".")} ${JSON.stringify(event.newValue)}`)
  );
  const obj = state.obj;
  const runs = reads.map(() => 0);
  const stops = reads.map((keys, i) =>
    watchEffect(() => {
      runs[i]++;
      for (const key of keys) obj[key];
    })
  );
  events.length = 0;
  try {
    body(obj, state);
  } finally {
    for (const stop of stops) stop();
  }
  return { events, runs, raw: toRaw(obj) };
}

/** An outer proxy as a membrane makes it: it hides the prototype and copies descriptors. */
function membrane(target) {
  return new Proxy(target, {
    getPrototypeOf: () => null,
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return descriptor && { ...descriptor };
    },
  });
}

/**
 * Ways to write `obj[key] = value`: the proxy itself, and receivers that
 * forward to it, so the write lands on the object.
 */
const routes = {
  direct: (obj, key, value) => (obj[key] = value),
  "an outer proxy": (obj, key, value) => (new Proxy(obj, {})[key] = value),
  "an outer proxy of an outer proxy": (obj, key, value) => (new Proxy(new Proxy(obj, {}), {})[key] = value),
  "an outer proxy whose set trap forwards the receiver": (obj, key, value) =>
    (new Proxy(obj, { set: (target, key, value, receiver) => Reflect.set(target, key, value, receiver) })[key] = value),
  "Reflect.set with an outer proxy as receiver": (obj, key, value) => Reflect.set(obj, key, value, new Proxy(obj, {})),
  "Reflect.set on an outer proxy": (obj, key, value) => Reflect.set(new Proxy(obj, {}), key, value),
  "a membrane": (obj, key, value) => (membrane(obj)[key] = value),
  "an outer proxy that hides the prototype": (obj, key, value) =>
    (new Proxy(obj, { getPrototypeOf: () => null })[key] = value),
  "an outer proxy that copies descriptors": (obj, key, value) =>
    (new Proxy(obj, { getOwnPropertyDescriptor: (target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return descriptor && { ...descriptor };
    } })[key] = value),
  "Reflect.set with a membrane as receiver": (obj, key, value) => Reflect.set(obj, key, value, membrane(obj)),
  "Object.defineProperty": (obj, key, value) =>
    Object.defineProperty(
      obj,
      key,
      Object.prototype.hasOwnProperty.call(obj, key) ? { value } : { value, writable: true, enumerable: true, configurable: true }
    ),
};

/**
 * Calls made while `body` runs that reach or come from the proxy's
 * `defineProperty` trap: `Reflect.defineProperty`, and `Reflect.set` with a
 * receiver (a write with the proxy as receiver ends in the trap).
 */
function definesDuring(body) {
  const { defineProperty, set } = Reflect;
  let calls = 0;
  Reflect.defineProperty = function (...args) {
    calls++;
    return defineProperty.apply(this, args);
  };
  Reflect.set = function (...args) {
    if (args.length > 3) calls++;
    return set.apply(this, args);
  };
  try {
    body();
  } finally {
    Reflect.defineProperty = defineProperty;
    Reflect.set = set;
  }
  return calls;
}

/** `{ name: check }` for the library `lib`. */
export function objectDefineCases(lib) {
  const { reactive, toRaw, watchEffect, updateState } = lib;
  const cases = {};

  // Until 3.0.15 such a write landed on the object with no event and no
  // rerun when the outer proxy had a `getPrototypeOf` trap, and a define
  // through the proxy sent nothing.
  const writes = [
    ["a key", "a", 9],
    ["a new key", "c", 7],
    ["an object", "a", { n: 1 }],
    ["the same value", "a", 1],
    ["a deep-equal object", "b", { n: 2 }],
    ["undefined at a new key", "d", undefined],
  ];
  for (const [name, route] of Object.entries(routes)) {
    if (name === "direct") continue;
    cases[`a write through ${name} sends each event once and reruns each effect once, as the write with =`] = () => {
      for (const [what, key, value] of writes) {
        const reads = [["a"], ["b"], ["c", "d"]];
        const direct = record(lib, { a: 1, b: { n: 2 } }, reads, (obj) => routes.direct(obj, key, value));
        const through = record(lib, { a: 1, b: { n: 2 } }, reads, (obj) => route(obj, key, value));
        assert.deepEqual(through, direct, what);
      }
      const direct = record(lib, { a: 1 }, [["a"]], (obj) => routes.direct(obj, "a", 2));
      assert.deepEqual([direct.events, direct.runs], [["set obj.a 2"], [2]]);
    };
  }

  // The direct write stores with no receiver: it never reaches the
  // `defineProperty` trap, so it pays nothing for it.
  cases["a direct write does not reach the defineProperty trap"] = () => {
    const state = reactive({ obj: { a: 1, b: { n: 1 } }, list: [1, 2] }, () => {});
    const { obj, list } = state;
    const direct = definesDuring(() => {
      obj.a = 2;
      obj.a = 2;
      obj.c = 3;
      obj.b = { n: 2 };
      obj.b = { n: 2 };
      obj.e = undefined;
      list[0] = 5;
      list[2] = 6;
      list.length = 1;
      list.bar = 1;
      Object.assign(obj, { a: 4, f: 5 });
    });
    assert.equal(direct, 0);
    // the counter sees the trap: an outer write reaches it
    assert.ok(definesDuring(() => (new Proxy(obj, {}).a = 9)) > 0);
    assert.ok(definesDuring(() => (new Proxy(obj, {}).g = 9)) > 0);
    assert.ok(definesDuring(() => (new Proxy(list, {})[0] = 9)) > 0);
    assert.deepEqual([toRaw(obj).a, toRaw(obj).g], [9, 9]);
  };

  // Another proxy of the state as receiver is another object: the write
  // lands on it and is sent on its path, as on plain objects. Until 3.0.15
  // its raw object got the key with no event and no rerun.
  cases["another proxy of the state as receiver gets the write and sends it on its own path"] = () => {
    for (const make of [() => ({ a: 1 }), () => [1, 2]]) {
      let otherRuns = 0;
      let rawOther;
      const result = record(lib, make(), [["a", "0"]], (obj, state) => {
        const stop = watchEffect(() => {
          otherRuns++;
          state.other.a;
          state.other[0];
        });
        rawOther = toRaw(state.other);
        assert.equal(Reflect.set(obj, "a", 9, state.other), true);
        assert.equal(Reflect.set(obj, "0", 8, state.other), true);
        stop();
      });
      assert.deepEqual(result.events, ["set other.a 9", "set other.0 8"]);
      assert.deepEqual([result.runs, otherRuns], [[1], 3]);
      assert.deepEqual(rawOther, { a: 9, 0: 8 });
      assert.deepEqual(result.raw, make());
    }
    // a setter reached that way runs with the other proxy as `this`
    class Model {
      get foo() {
        return this.bar;
      }
      set foo(value) {
        this.bar = value;
        this.baz = value;
      }
    }
    const raw = Object.assign(new Model(), { bar: 1 });
    const result = record(lib, raw, [["foo", "bar"]], (obj, state) => {
      assert.equal(Reflect.set(obj, "foo", 4, state.other), true);
    });
    assert.deepEqual([result.events, result.runs], [["set other.bar 4", "set other.baz 4"], [1]]);
    assert.deepEqual({ ...result.raw }, { bar: 1 });
  };

  // A wrapper's own defineProperty trap decides, as for a plain object.
  cases["an outer proxy that refuses defineProperty: the write fails and sends nothing"] = () => {
    const result = record(lib, { a: 1 }, [["a", "b"]], (obj) => {
      const readOnly = new Proxy(obj, { defineProperty: () => false });
      assert.equal(Reflect.set(readOnly, "a", 9), false);
      assert.equal(Reflect.set(readOnly, "b", 9), false);
      assert.throws(() => {
        readOnly.a = 9;
      }, TypeError);
    });
    assert.deepEqual([result.events, result.runs, result.raw], [[], [1], { a: 1 }]);
  };

  // `Object.defineProperty` with flags alone on a key the object does not
  // have creates it, holding `undefined`: the write of `undefined`.
  cases["flags alone on a new key write undefined: the event of the write, and effects rerun"] = () => {
    const descriptor = { writable: true, enumerable: true, configurable: true };
    const defined = record(lib, { a: 1 }, [["a"], ["c"]], (obj) => assert.equal(Reflect.defineProperty(obj, "c", descriptor), true));
    const written = record(lib, { a: 1 }, [["a"], ["c"]], (obj) => (obj.c = undefined));
    assert.deepEqual(defined, written);
    assert.deepEqual(defined.events, ["set obj.c undefined"]);
  };

  // Flags alone on a key the object has change no value: no event, no rerun.
  cases["Object.freeze through an object proxy freezes it and sends nothing"] = () => {
    const result = record(lib, { a: 1, b: { n: 1 } }, [["a", "b"]], (obj) => {
      Object.freeze(obj);
      assert.equal(Reflect.set(obj, "a", 2), false);
      assert.equal(Reflect.set(obj, "c", 2), false);
    });
    assert.deepEqual([result.events, result.runs], [[], [1]]);
    assert.equal(Object.isFrozen(result.raw), true);
    assert.deepEqual(result.raw, { a: 1, b: { n: 1 } });
  };

  cases["flags alone on a new key of a non-extensible object fail and send nothing"] = () => {
    const descriptor = { writable: true, enumerable: true, configurable: true };
    const result = record(lib, Object.preventExtensions({ a: 1 }), [["a", "c"]], (obj) => {
      assert.equal(Reflect.defineProperty(obj, "c", descriptor), false);
      assert.throws(() => Object.defineProperty(obj, "c", descriptor), TypeError);
      assert.equal(Reflect.set(new Proxy(obj, {}), "c", 1), false);
    });
    assert.deepEqual([result.events, result.runs, result.raw], [[], [1], { a: 1 }]);
  };

  cases["writable alone makes an own accessor a data property holding undefined: an event, and effects rerun"] = () => {
    const accessor = () => Object.defineProperty({ a: 1 }, "bar", { get: () => 5, configurable: true, enumerable: true });
    const result = record(lib, accessor(), [["bar"]], (obj) => {
      assert.equal(obj.bar, 5);
      Object.defineProperty(obj, "bar", { writable: true });
      assert.equal(obj.bar, undefined);
    });
    assert.deepEqual([result.events, result.runs], [["set obj.bar undefined"], [2]]);
    const kept = record(lib, accessor(), [["bar"]], (obj) => Object.defineProperty(obj, "bar", { enumerable: false }));
    assert.deepEqual([kept.events, kept.runs], [[], [1]]);
    assert.equal(typeof Object.getOwnPropertyDescriptor(kept.raw, "bar").get, "function");
  };

  // An accessor sends no event (a replica copies no accessor); the effects
  // that read the key rerun, and a new key reruns every reader of a key.
  cases["an accessor defined through an object proxy reruns its readers and sends nothing"] = () => {
    const result = record(lib, { a: 1 }, [["a"], ["g"]], (obj) => {
      Object.defineProperty(obj, "g", { get: () => 3, configurable: true });
      assert.equal(obj.g, 3);
      Object.defineProperty(obj, "g", { get: () => 4, configurable: true });
    });
    assert.deepEqual([result.events, result.runs], [[], [2, 3]]);
  };

  // An own setter replaced by a define with a value is data from then on:
  // the define is sent like the write, and later writes store data.
  cases["Object.defineProperty with a value replaces an own setter with data and is sent"] = () => {
    let calls = 0;
    const raw = Object.defineProperty({ a: 1 }, "foo", {
      get: () => "accessor",
      set: () => calls++,
      configurable: true,
    });
    const result = record(lib, raw, [["foo"]], (obj) => {
      Object.defineProperty(obj, "foo", { value: 1, writable: true, enumerable: true, configurable: true });
      obj.foo = 2;
    });
    assert.deepEqual([result.events, result.runs, calls], [['set obj.foo 1', 'set obj.foo 2'], [3], 0]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(result.raw, "foo"), { value: 2, writable: true, enumerable: true, configurable: true });
  };

  cases["Object.defineProperties through an object proxy sends one event per key, as the writes with ="] = () => {
    const reads = [["a"], ["c"], ["d"]];
    const defined = record(lib, { a: 1 }, reads, (obj) =>
      Object.defineProperties(obj, {
        a: { value: 5 },
        c: { value: 6, writable: true, enumerable: true, configurable: true },
        d: { value: { n: 1 }, writable: true, enumerable: true, configurable: true },
      })
    );
    const written = record(lib, { a: 1 }, reads, (obj) => {
      obj.a = 5;
      obj.c = 6;
      obj.d = { n: 1 };
    });
    assert.deepEqual(defined, written);
    assert.deepEqual(defined.events, ["set obj.a 5", "set obj.c 6", 'set obj.d {"n":1}']);
  };

  // A replica that applies the events holds what the object holds, on every route.
  cases["a replica built from writes on every route and from defines matches the object"] = () => {
    const raw = { obj: { a: 1, b: { n: 2 } } };
    const remote = structuredClone(raw);
    const state = reactive(raw, (event) => updateState(remote, structuredClone(event)));
    const obj = state.obj;
    let step = 0;
    for (const route of Object.values(routes)) {
      step++;
      route(obj, "a", step);
      route(obj, `k${step}`, { deep: [step] });
      route(obj, "b", { n: step });
      assert.deepEqual(remote.obj, toRaw(obj), String(step));
    }
    Object.defineProperty(obj, "e", { enumerable: true, writable: true, configurable: true });
    Object.defineProperties(obj, { a: { value: 0 }, f: { value: [1], writable: true, enumerable: true, configurable: true } });
    assert.deepEqual(remote.obj, toRaw(obj));
  };

  // A define stores the raw object, as `=` does: no proxy in the state.
  cases["an outer-proxy write or a define of an object holding proxies stores it raw"] = () => {
    const state = reactive({ obj: { a: 1 }, items: [{ n: 1 }] }, () => {});
    const item = state.items[0];
    new Proxy(state.obj, {}).x = { item };
    membrane(state.obj).y = item;
    Object.defineProperty(state.obj, "z", { value: item, writable: true, enumerable: true, configurable: true });
    const raw = toRaw(state.obj);
    assert.equal(raw.x.item, toRaw(item));
    assert.equal(raw.y, toRaw(item));
    assert.equal(raw.z, toRaw(item));
  };

  cases["an effect that defines or writes through a membrane what it reads runs once per change"] = () => {
    const state = reactive({ obj: { a: 1, b: 1 } }, () => {});
    const obj = state.obj;
    let runs = 0;
    const stop = watchEffect(() => {
      runs++;
      Object.defineProperty(obj, "a", { value: obj.b + 1 });
      membrane(obj).c = obj.a;
    });
    assert.equal(runs, 1);
    assert.deepEqual(toRaw(obj), { a: 2, b: 1, c: 2 });
    obj.b = 5;
    assert.equal(runs, 2);
    assert.deepEqual(toRaw(obj), { a: 6, b: 5, c: 6 });
    stop();
  };

  // The setter's writes are events of their own: a listener that writes
  // during the first one is delivered in between, in write order.
  cases["a listener that writes during a setter's write is delivered between the setter's writes"] = () => {
    class Model {
      get foo() {
        return this.bar;
      }
      set foo(value) {
        this.bar = value;
        this.baz = value;
      }
    }
    const makes = {
      inherited: () => Object.assign(new Model(), { bar: 0, baz: 0, log: 0 }),
      own: () =>
        Object.defineProperty({ bar: 0, baz: 0, log: 0 }, "foo", {
          get() {
            return this.bar;
          },
          set(value) {
            this.bar = value;
            this.baz = value;
          },
          configurable: true,
        }),
    };
    for (const [kind, make] of Object.entries(makes)) {
      for (const [name, route] of Object.entries(routes)) {
        if (name === "Object.defineProperty") continue;
        const events = [];
        let state;
        state = reactive({ c: make() }, (event) => {
          events.push(`${event.action} ${event.path.join(".")} ${JSON.stringify(event.newValue)}`);
          if (event.path[1] === "bar") state.c.log = event.newValue * 10;
        });
        events.length = 0;
        route(state.c, "foo", 3);
        assert.deepEqual(events, ["set c.bar 3", "set c.log 30", "set c.baz 3"], `${kind}, ${name}`);
      }
    }
  };

  // Inside a flush the rule holds as outside: an effect's setter write
  // reruns a reader of the key and of the setter's writes once.
  cases["a setter write made by an effect in a flush reruns each reader once"] = () => {
    class Model {
      get foo() {
        return this.bar;
      }
      set foo(value) {
        this.bar = value;
        this.baz = value;
      }
    }
    for (const [name, route] of Object.entries(routes)) {
      if (name === "Object.defineProperty") continue;
      const state = reactive({ c: Object.assign(new Model(), { bar: 0, baz: 0, t: 0 }) }, () => {});
      const c = state.c;
      let writerRuns = 0;
      let readerRuns = 0;
      const seen = [];
      const writer = watchEffect(() => {
        writerRuns++;
        const t = c.t;
        if (t > 0) route(c, "foo", t);
      });
      const reader = watchEffect(() => {
        readerRuns++;
        seen.push([c.foo, c.bar, c.baz]);
      });
      c.t = 4;
      assert.deepEqual([writerRuns, readerRuns], [2, 2], name);
      assert.deepEqual(seen.at(-1), [4, 4, 4], name);
      c.t = 4;
      assert.deepEqual([writerRuns, readerRuns], [2, 2], name);
      writer();
      reader();
    }
  };

  // An object with more than 64 own keys is not scanned for accessors:
  // each write reads its key's descriptor. Setters and data still follow
  // the rules.
  cases["an object with more than 64 own keys and an own setter follows the setter rule"] = () => {
    const make = () => {
      const raw = {};
      for (let i = 0; i < 70; i++) raw[`k${i}`] = i;
      return Object.defineProperty(raw, "foo", {
        get() {
          return this.k0;
        },
        set(value) {
          this.k0 = value;
          this.k1 = value;
        },
        configurable: true,
      });
    };
    for (const [name, route] of Object.entries(routes)) {
      if (name === "Object.defineProperty") continue;
      const result = record(lib, make(), [["foo", "k0", "k1"], ["k5"]], (obj) => {
        route(obj, "foo", 9);
        route(obj, "foo", 9);
        route(obj, "k5", 50);
        route(obj, "k5", 50);
      });
      assert.deepEqual([result.events, result.runs], [["set obj.k0 9", "set obj.k1 9", "set obj.k5 50"], [2, 2]], name);
      assert.equal(typeof Object.getOwnPropertyDescriptor(result.raw, "foo").set, "function", name);
    }
  };

  // An outer proxy whose write of an own key landed is remembered for that
  // key (the trip through it costs more than the write). What it decides
  // before the write still decides: its set trap, and its traps for other keys.
  cases["a remembered outer proxy still runs its set trap on every write"] = () => {
    let calls = 0;
    let refuse = false;
    const result = record(lib, { a: 1 }, [["a"]], (obj) => {
      const outer = new Proxy(obj, {
        set(target, key, value, receiver) {
          calls++;
          return refuse ? false : Reflect.set(target, key, value, receiver);
        },
      });
      outer.a = 2;
      outer.a = 3;
      refuse = true;
      assert.equal(Reflect.set(outer, "a", 4), false);
    });
    assert.deepEqual([result.events, result.runs, calls, result.raw], [["set obj.a 2", "set obj.a 3"], [3], 3, { a: 3 }]);
  };

  cases["an outer proxy that refuses some keys keeps refusing them after other keys landed"] = () => {
    const result = record(lib, { a: 1, locked: 1 }, [["a", "locked"]], (obj) => {
      const guarded = new Proxy(obj, {
        defineProperty: (target, key, descriptor) => key !== "locked" && Reflect.defineProperty(target, key, descriptor),
      });
      for (let i = 2; i < 5; i++) {
        guarded.a = i;
        assert.equal(Reflect.set(guarded, "locked", i), false);
      }
    });
    assert.deepEqual([result.events, result.runs, result.raw], [["set obj.a 2", "set obj.a 3", "set obj.a 4"], [4], { a: 4, locked: 1 }]);
  };

  // A membrane that does not report the key makes the write define a new
  // enumerable key, as on a plain object, every time: it is not remembered.
  cases["an outer proxy that hides a key defines it as on a plain object on every write"] = () => {
    const hiding = (target) => new Proxy(target, { getOwnPropertyDescriptor: (target, key) => (key === "a" ? undefined : Reflect.getOwnPropertyDescriptor(target, key)) });
    const make = () => Object.defineProperty({}, "a", { value: 1, writable: true, enumerable: false, configurable: true });
    const plain = make();
    const plainHiding = hiding(plain);
    const result = record(lib, make(), [["a"]], (obj) => {
      const outer = hiding(obj);
      for (const value of [2, 3]) {
        outer.a = value;
        plainHiding.a = value;
        assert.deepEqual(Object.getOwnPropertyDescriptor(toRaw(obj), "a"), Object.getOwnPropertyDescriptor(plain, "a"));
        assert.equal(Object.getOwnPropertyDescriptor(plain, "a").enumerable, true);
        Object.defineProperty(toRaw(obj), "a", { enumerable: false });
        Object.defineProperty(plain, "a", { enumerable: false });
      }
    });
    assert.deepEqual([result.events, result.runs], [["set obj.a 2", "set obj.a 3"], [3]]);
  };

  cases["a remembered outer proxy writes a key deleted and added again, or made read-only, as the plain write"] = () => {
    const result = record(lib, { a: 1 }, [["a"]], (obj) => {
      const outer = new Proxy(obj, {});
      outer.a = 2;
      outer.a = 3;
      delete obj.a;
      outer.a = 4;
      outer.a = 5;
      Object.freeze(obj);
      assert.equal(Reflect.set(outer, "a", 6), false);
      assert.throws(() => {
        outer.a = 6;
      }, TypeError);
    });
    assert.deepEqual(result.events, ["set obj.a 2", "set obj.a 3", "delete obj.a undefined", "set obj.a 4", "set obj.a 5"]);
    assert.deepEqual([result.runs, result.raw], [[6], { a: 5 }]);
  };

  // A receiver's trap that defines another key on the object while the
  // write is on its way (here: a log) does not make that key remembered.
  cases["a define made by a receiver's trap on the way is not taken for the receiver's write"] = () => {
    const result = record(lib, { a: 1, log: 0 }, [["a", "log"]], (obj) => {
      const logging = new Proxy(obj, {
        getOwnPropertyDescriptor(target, key) {
          if (key === "a") Object.defineProperty(obj, "log", { value: toRaw(obj).log + 1 });
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        defineProperty: (target, key, descriptor) => key !== "log" && Reflect.defineProperty(target, key, descriptor),
      });
      logging.a = 2;
      logging.a = 3;
      assert.equal(Reflect.set(logging, "log", 9), false);
    });
    assert.deepEqual(result.events, ["set obj.log 1", "set obj.a 2", "set obj.log 2", "set obj.a 3"]);
    assert.deepEqual(result.raw, { a: 3, log: 2 });
  };

  // A define with a value alone keeps the define's defaults: a new key is
  // read-only, hidden and fixed; an accessor becomes data without its setter running.
  cases["a define with a value alone defines, it does not assign"] = () => {
    let calls = 0;
    const raw = Object.defineProperty({ a: 1 }, "acc", { get: () => 0, set: () => calls++, configurable: true, enumerable: true });
    const result = record(lib, raw, [["c", "acc"]], (obj) => {
      Object.defineProperty(obj, "c", { value: 1 });
      Object.defineProperty(obj, "acc", { value: 2 });
    });
    assert.deepEqual([result.events, calls], [["set obj.c 1", "set obj.acc 2"], 0]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(result.raw, "c"), { value: 1, writable: false, enumerable: false, configurable: false });
    assert.deepEqual(Object.getOwnPropertyDescriptor(result.raw, "acc"), { value: 2, writable: false, enumerable: true, configurable: true });
  };

  // An object marked as data only by its first write is scanned again after
  // an accessor is defined through its proxy: the setter rule applies.
  cases["a setter defined through the proxy after a write follows the setter rule"] = () => {
    const result = record(lib, { a: 1, x: 0 }, [["g", "x"]], (obj) => {
      obj.a = 2;
      Object.defineProperty(obj, "g", {
        get() {
          return this.x;
        },
        set(value) {
          this.x = value;
        },
        configurable: true,
      });
      obj.g = 5;
      obj.g = 5;
    });
    assert.deepEqual(result.events, ["set obj.a 2", "set obj.x 5"]);
    assert.deepEqual(result.runs, [3]);
  };

  // Only a proxy's getPrototypeOf can make an endless prototype chain: the
  // receiver check stops and runs the setter as for a child.
  cases["a setter write through an outer proxy with an endless prototype chain ends"] = () => {
    class Model {
      get foo() {
        return this.bar;
      }
      set foo(value) {
        this.bar = value;
      }
    }
    const endless = new Proxy({}, { getPrototypeOf: () => endless });
    const result = record(lib, Object.assign(new Model(), { bar: 1 }), [["bar"]], (obj) => {
      const outer = new Proxy(obj, { getPrototypeOf: () => endless });
      outer.foo = 2;
      outer.foo = 2;
    });
    assert.deepEqual([result.events, result.runs], [["set obj.bar 2"], [2]]);
  };

  // Not remembered: another receiver lands on itself, a child on itself.
  cases["a receiver that does not forward is never remembered"] = () => {
    const result = record(lib, { a: 1 }, [["a"]], (obj, state) => {
      const child = Object.create(obj);
      for (let i = 2; i < 4; i++) {
        child.a = i;
        assert.equal(Reflect.set(obj, "a", i, state.other), true);
        assert.equal(Reflect.set(obj, "a", i, toRaw(state.other)), true);
      }
      assert.equal(child.a, 3);
    });
    assert.deepEqual([result.events, result.runs, result.raw], [["set other.a 2", "set other.a 3"], [1], { a: 1 }]);
  };

  // The rule README states: a receiver's traps that answer differently for
  // a key after its write landed are outside the supported input. The
  // remembered write lands on the object and is sent; replicas stay equal.
  cases["a defineProperty trap that starts to refuse a remembered key is not asked again"] = () => {
    let refuse = false;
    const result = record(lib, { a: 1 }, [["a"]], (obj) => {
      const outer = new Proxy(obj, { defineProperty: (target, key, descriptor) => !refuse && Reflect.defineProperty(target, key, descriptor) });
      outer.a = 2;
      refuse = true;
      outer.a = 3;
    });
    assert.deepEqual([result.events, result.raw], [["set obj.a 2", "set obj.a 3"], { a: 3 }]);
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = objectDefineCases(await import(pathToFileURL(resolve(process.argv[2])).href));
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
