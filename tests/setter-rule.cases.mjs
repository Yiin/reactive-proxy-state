// One rule for every setter (3.0.15): own or inherited, on an array or an
// object, a write through a setter runs in one batch with the setter's own
// writes and reruns the readers of its key after it succeeds. Run by Bun
// (tests/setter-rule.bun.test.ts) and by Node on a bundle of the current
// source: node tests/setter-rule.cases.mjs <bundle>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Ways to write `container[key] = value` that land on the container: the
 * proxy itself, and receivers that forward to it.
 */
const routes = {
  direct: (container, key, value) => (container[key] = value),
  "an outer proxy": (container, key, value) => (new Proxy(container, {})[key] = value),
  "an outer proxy of an outer proxy": (container, key, value) => (new Proxy(new Proxy(container, {}), {})[key] = value),
  "an outer proxy whose set trap forwards the receiver": (container, key, value) =>
    (new Proxy(container, { set: (target, key, value, receiver) => Reflect.set(target, key, value, receiver) })[key] = value),
  "Reflect.set with an outer proxy as receiver": (container, key, value) =>
    Reflect.set(container, key, value, new Proxy(container, {})),
  "Reflect.set on an outer proxy": (container, key, value) => Reflect.set(new Proxy(container, {}), key, value),
};

/**
 * The accessor `foo`, own or inherited, on an array or an object. `get`
 * and `set` take the container as `this`. `get` may be undefined.
 */
function containers(get, set) {
  const accessor = { set, configurable: true };
  if (get !== undefined) accessor.get = get;
  class InheritedArray extends Array {}
  Object.defineProperty(InheritedArray.prototype, "foo", accessor);
  class InheritedObject {}
  Object.defineProperty(InheritedObject.prototype, "foo", accessor);
  return {
    "an inherited setter on an array": () => InheritedArray.from([1]),
    "an own setter on an array": () => Object.defineProperty([1], "foo", accessor),
    "an inherited setter on an object": () => Object.assign(new InheritedObject(), { a: 1 }),
    "an own setter on an object": () => Object.defineProperty({ a: 1 }, "foo", accessor),
  };
}

/**
 * `{ events, runs, raw }` of `body(proxy)` on `{ c: make() }`, with one
 * effect per entry of `reads` (each reads its keys). `runs` counts each
 * effect's runs after its first; `order` names the effects as they rerun.
 * `body` also gets `runs`, to read them while it writes.
 */
function record(lib, make, reads, body) {
  const { reactive, watchEffect, toRaw } = lib;
  const events = [];
  const state = reactive({ c: make() }, (event) =>
    events.push(`${event.action} ${event.path.join(".")} ${JSON.stringify(event.newValue)}`)
  );
  const proxy = state.c;
  const runs = reads.map(() => 0);
  const order = [];
  let started = false;
  const stops = reads.map((keys, i) =>
    watchEffect(() => {
      for (const key of keys) proxy[key];
      if (!started) return;
      runs[i]++;
      order.push(i);
    })
  );
  started = true;
  events.length = 0;
  try {
    body(proxy, runs);
  } finally {
    for (const stop of stops) stop();
  }
  return { events, runs, order, raw: toRaw(proxy) };
}

/** `{ name: check }` for the library `lib`. */
export function setterRuleCases(lib) {
  const { reactive, watchEffect, toRaw, updateState } = lib;
  const cases = {};

  // The get trap tracks the key before it knows it is an accessor, so a
  // getter that reads a closure needs the rerun. Until 3.0.14 an own
  // setter reran no reader of its key: the effect kept the old value.
  cases["a setter backed by a closure reruns the readers of its key, own or inherited, on every route"] = () => {
    let hidden = 1;
    const kinds = containers(
      () => hidden,
      (value) => (hidden = value)
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        hidden = 1;
        let seen;
        const result = record(lib, make, [["foo"]], (proxy) => {
          route(proxy, "foo", 7);
          seen = proxy.foo;
          // the value the getter gives changes nothing
          route(proxy, "foo", 7);
        });
        assert.deepEqual([result.events, result.runs, seen], [[], [1], 7], `${kind}, ${name}`);
      }
    }
  };

  // Until 3.0.14 an own setter ran outside a batch: a reader of both keys
  // ran once per key. An inherited setter on an object also sent `set` of
  // its key, after the setter's own events.
  cases["a setter that writes two keys reruns a reader of the key and both keys once, and sends only its writes"] = () => {
    const kinds = containers(
      function () {
        return this.bar;
      },
      function (value) {
        this.bar = value;
        this.baz = value;
      }
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        const result = record(lib, make, [["foo", "bar", "baz"]], (proxy) => route(proxy, "foo", 4));
        assert.deepEqual([result.events, result.runs], [["set c.bar 4", "set c.baz 4"], [1]], `${kind}, ${name}`);
        assert.deepEqual([result.raw.bar, result.raw.baz], [4, 4], `${kind}, ${name}`);
        assert.equal(Object.hasOwn(result.raw, "foo"), kind.includes("own"), `${kind}, ${name}`);
      }
    }
  };

  // A replica stores what the events carry. Until 3.0.14 an inherited
  // setter on an object sent `set c.foo`, and the replica held `foo` as
  // data where the object has none.
  cases["a replica of an object written through setters equals the object"] = () => {
    let hidden = 0;
    class Model {
      get total() {
        return this.count * 2;
      }
      set total(value) {
        this.count = value / 2;
        this.touched = true;
      }
      get secret() {
        return hidden;
      }
      set secret(value) {
        hidden = value;
      }
    }
    const raw = { c: Object.assign(new Model(), { count: 1 }) };
    const remote = structuredClone({ c: { ...raw.c } });
    const events = [];
    const state = reactive(raw, (event) => {
      events.push(`${event.action} ${event.path.join(".")}`);
      updateState(remote, structuredClone(event));
    });
    events.length = 0;
    for (const [name, route] of Object.entries(routes)) {
      route(state.c, "total", 10 + name.length);
      route(state.c, "secret", name.length);
      assert.deepEqual(remote.c, { ...raw.c }, name);
      assert.deepEqual(Object.keys(remote.c).sort(), ["count", "touched"], name);
    }
    assert.ok(events.every((event) => event === "set c.count" || event === "set c.touched"), events.join(", "));
    assert.equal(hidden, "Reflect.set on an outer proxy".length);
  };

  // A setter with no getter has no value to compare: it runs on every
  // write. Until 3.0.14 a write of `undefined` read the missing getter as
  // `undefined` and skipped the setter.
  cases["a setter with no getter runs on every write, also of undefined"] = () => {
    let calls = 0;
    const kinds = containers(undefined, function () {
      calls++;
    });
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        calls = 0;
        const result = record(lib, make, [["foo"]], (proxy) => {
          route(proxy, "foo", undefined);
          route(proxy, "foo", undefined);
          route(proxy, "foo", 1);
        });
        assert.deepEqual([calls, result.events, result.runs], [3, [], [3]], `${kind}, ${name}`);
      }
    }
  };

  cases["a write the getter already gives runs no setter, own or inherited"] = () => {
    let calls = 0;
    const kinds = containers(
      function () {
        return this.bar;
      },
      function (value) {
        calls++;
        this.bar = value;
        this.baz = value;
      }
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        calls = 0;
        const result = record(lib, make, [["foo", "bar", "baz"]], (proxy) => {
          route(proxy, "foo", undefined);
          route(proxy, "foo", { n: 1 });
          // a deep-equal object is the value the getter gives
          route(proxy, "foo", { n: 1 });
        });
        assert.deepEqual([calls, result.events, result.runs], [1, ['set c.bar {"n":1}', 'set c.baz {"n":1}'], [1]], `${kind}, ${name}`);
      }
    }
  };

  // The batch ends in a `finally`: a later write reruns its effects at once.
  cases["a setter that throws leaves no batch open"] = () => {
    const kinds = containers(
      function () {
        return this.bar;
      },
      function (value) {
        this.bar = value;
        throw new Error("refused");
      }
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        // `bar` and `qux` exist: a new key of an object reruns every reader of a key
        const result = record(lib, () => Object.assign(make(), { bar: 0, qux: 0 }), [["bar"], ["qux"]], (proxy, runs) => {
          assert.throws(() => route(proxy, "foo", 2), /refused/);
          // the setter's write before the throw reran its reader
          assert.deepEqual(runs, [1, 0]);
          proxy.qux = 1;
          assert.deepEqual(runs, [1, 1]);
        });
        assert.deepEqual(result.events, ["set c.bar 2", "set c.qux 1"], `${kind}, ${name}`);
      }
    }
  };

  // The readers of the setter's writes queue as the writes happen, the
  // readers of its key after the setter: they run in that order.
  cases["the readers of a setter's writes rerun before the readers of its key"] = () => {
    let hidden = 0;
    const kinds = containers(
      () => hidden,
      function (value) {
        hidden = value;
        this.bar = value;
      }
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        hidden = 0;
        // effect 0 reads the key, effect 1 what the setter writes (a key
        // the container has: a new key of an object reruns every reader of a key)
        const result = record(lib, () => Object.assign(make(), { bar: 0 }), [["foo"], ["bar"]], (proxy) =>
          route(proxy, "foo", 5)
        );
        assert.deepEqual([result.runs, result.order], [[1, 1], [1, 0]], `${kind}, ${name}`);
      }
    }
  };

  // `__proto__` is the setter of Object.prototype, inherited by arrays and
  // objects: it changes the prototype and sends nothing, on every route.
  // A replica cannot apply a prototype. Until 3.0.14 an object sent
  // `set c.__proto__`.
  cases["c.__proto__ = proto changes the prototype on every route, sends nothing, and reruns its readers"] = () => {
    for (const [kind, make, proto] of [
      ["array", () => [1, 2], Object.create(Array.prototype, { extra: { value: "from proto" } })],
      ["object", () => ({ a: 1 }), { extra: "from proto" }],
    ]) {
      for (const [name, route] of Object.entries(routes)) {
        let seen;
        const result = record(lib, make, [["__proto__"]], (proxy) => {
          route(proxy, "__proto__", proto);
          seen = proxy.__proto__;
        });
        assert.deepEqual([result.events, result.runs], [[], [1]], `${kind}, ${name}`);
        // an object proxy gives an object it reads as a proxy
        assert.equal(toRaw(seen), proto, `${kind}, ${name}`);
        assert.equal(Object.getPrototypeOf(result.raw), proto, `${kind}, ${name}`);
        assert.equal(result.raw.extra, "from proto", `${kind}, ${name}`);
        assert.equal(Object.hasOwn(result.raw, "__proto__"), false, `${kind}, ${name}`);
      }
    }
  };

  // A receiver that does not forward to the proxy gets the write, as on a
  // plain array or object. A setter runs with that receiver as `this`,
  // also when the getter gives the value, and its writes land there. The
  // readers of the key rerun only when the getter gives another value
  // afterwards: a setter can change what the getter reads, such as a
  // closure. Until 3.0.14 such a write reran them always on an array, and
  // skipped the setter when the getter gave the value.
  cases["a setter reached through Object.create(container) runs as on a plain container"] = () => {
    const kinds = containers(
      function () {
        return this.bar;
      },
      function (value) {
        this.bar = value;
        this.baz = value;
      }
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const value of [7, 8]) {
        let child;
        const result = record(lib, () => Object.assign(make(), { bar: 7 }), [["foo"], ["bar", "baz"]], (proxy) => {
          child = Object.create(proxy);
          child.foo = value;
        });
        // the same write on a plain container
        const plain = Object.create(Object.assign(make(), { bar: 7 }));
        plain.foo = value;
        assert.deepEqual([result.events, result.runs], [[], [0, 0]], `${kind}, ${value}`);
        assert.deepEqual(Object.keys(child).sort(), Object.keys(plain).sort(), `${kind}, ${value}`);
        assert.deepEqual([child.bar, child.baz], [value, value], `${kind}, ${value}`);
        assert.deepEqual([result.raw.bar, result.raw.baz], [7, undefined], `${kind}, ${value}`);
      }
    }
    let hidden = 1;
    const closures = containers(
      () => hidden,
      (value) => (hidden = value)
    );
    for (const [kind, make] of Object.entries(closures)) {
      hidden = 1;
      const result = record(lib, make, [["foo"]], (proxy) => {
        Object.create(proxy).foo = 2;
        Object.create(proxy).foo = 2;
      });
      // the closure changed once
      assert.deepEqual([result.events, result.runs, hidden], [[], [1], 2], kind);
    }
  };

  // The raw container as receiver is a raw write (README, "Raw writes"):
  // its setter writes the raw container and sends nothing. The readers of
  // the key rerun when its getter gives another value.
  cases["a setter reached with the raw container as receiver writes the raw container and sends nothing"] = () => {
    const kinds = containers(
      function () {
        return this.bar;
      },
      function (value) {
        this.bar = value;
        this.baz = value;
      }
    );
    for (const [kind, make] of Object.entries(kinds)) {
      const result = record(lib, make, [["foo"], ["baz"]], (proxy) => {
        assert.equal(Reflect.set(proxy, "foo", 5, toRaw(proxy)), true);
        assert.equal(Reflect.set(proxy, "foo", 5, toRaw(proxy)), true);
      });
      assert.deepEqual([result.events, result.runs], [[], [1, 0]], kind);
      assert.deepEqual([result.raw.bar, result.raw.baz], [5, 5], kind);
    }
  };

  // Until 3.0.14 an object proxy sent `set` for a write that landed on such
  // a receiver: a replica got a key the object did not.
  cases["a data write to an object through a receiver that does not forward lands on it and sends nothing"] = () => {
    const plain = {};
    let child;
    const result = record(lib, () => ({ a: 1 }), [["a", "b"]], (proxy) => {
      child = Object.create(proxy);
      child.a = 2;
      child.b = 3;
      assert.equal(Reflect.set(proxy, "a", 4, plain), true);
    });
    assert.deepEqual([result.events, result.runs], [[], [0]]);
    assert.deepEqual(result.raw, { a: 1 });
    assert.deepEqual({ ...child }, { a: 2, b: 3 });
    assert.deepEqual(plain, { a: 4 });
    // the raw object as receiver: a raw write
    const raw = record(lib, () => ({ a: 1 }), [["a"]], (proxy) => {
      assert.equal(Reflect.set(proxy, "a", 5, toRaw(proxy)), true);
    });
    assert.deepEqual([raw.events, raw.runs, raw.raw], [[], [0], { a: 5 }]);
  };

  cases["an effect that writes an own or inherited accessor it reads runs once per change"] = () => {
    let hidden = 0;
    const kinds = containers(
      () => hidden,
      (value) => (hidden = value)
    );
    for (const [kind, make] of Object.entries(kinds)) {
      for (const [name, route] of Object.entries(routes)) {
        hidden = 0;
        const state = reactive({ c: make() }, () => {});
        const proxy = state.c;
        let runs = 0;
        const stop = watchEffect(() => {
          runs++;
          route(proxy, "foo", proxy.foo + 1);
        });
        assert.deepEqual([runs, hidden], [1, 1], `${kind}, ${name}`);
        proxy.foo = 10;
        assert.deepEqual([runs, hidden], [2, 11], `${kind}, ${name}`);
        stop();
      }
    }
  };

  return cases;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cases = setterRuleCases(await import(pathToFileURL(resolve(process.argv[2])).href));
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
