// Random writes to an array or object proxy, made through other receivers
// (3.0.13; a membrane and another proxy of the state in 3.0.16) and through
// accessors (3.0.14, one setter rule in 3.0.15). A
// write through a receiver that forwards to the proxy lands on the
// container, so it must send the events and rerun the effects of the same
// write made directly on the proxy. A model of the write semantics gives
// the effect runs, the container, and the replica that applied the events.
import fc from "fast-check";

/** The array as a whole: what `for...of` reads. */
export const ITERATE = "iterate";
const indexKeys = ["0", "1", "2", "3", "4", "5"];
/** An object's own data keys, besides the named keys. */
const fieldKeys = ["a", "b"];
const namedKeys = ["bar", "extra"];
/**
 * Accessors, the same on arrays and objects (see `makeContainer`). On the
 * class prototype: `hidden` keeps its value in a closure; `mirror` reads
 * `bar` and writes `bar` and `extra`; `sink` has no getter and writes
 * `extra`. The container's own, not enumerable: `ownHidden` keeps its value
 * in a closure; `ownMirror` reads `extra` and writes `extra` and `bar`;
 * `ownSink` has no getter and keeps its value in a closure.
 */
const accessorKeys = ["hidden", "mirror", "sink", "ownHidden", "ownMirror", "ownSink"];
const getterless = new Set(["sink", "ownSink"]);
const arrayReadKeys = [...indexKeys, "length", ...namedKeys, ...accessorKeys, ITERATE];
const objectReadKeys = [...fieldKeys, ...namedKeys, ...accessorKeys];

/** Item values: equal primitives, a hole-like undefined, and deep-equal objects. */
const valueArbitrary = fc.oneof(
  fc.constantFrom(0, 1, 2, undefined),
  fc.integer({ min: 0, max: 1 }).map((n) => ({ object: { n } }))
);

/**
 * Ways to write `container[key] = value`. The first eight forward to the
 * proxy, so the write lands on the container. `membrane` is an outer proxy
 * whose `getPrototypeOf` hides the prototype and whose
 * `getOwnPropertyDescriptor` gives copies, as a membrane does. `child`
 * writes to a fresh `Object.create(container)`, `other` gives another
 * proxy of the state (`state.other`, an object) as the receiver, and `raw`
 * gives the raw container: such a write lands on that receiver, as on a
 * plain container. A raw write changes the container and no replica
 * (README, "Raw writes"): the replica stops at the first one.
 */
export const routes = {
  direct: (container, key, value) => Reflect.set(container, key, value),
  outer: (container, key, value, outer) => Reflect.set(outer, key, value),
  outerOfOuter: (container, key, value, outer) => Reflect.set(new Proxy(outer, {}), key, value),
  forwardingSetTrap: (container, key, value) =>
    Reflect.set(
      new Proxy(container, { set: (target, key, value, receiver) => Reflect.set(target, key, value, receiver) }),
      key,
      value
    ),
  reflectWithOuterReceiver: (container, key, value, outer) => Reflect.set(container, key, value, outer),
  assignToOuter: (container, key, value, outer) => {
    outer[key] = value;
    return true;
  },
  membrane: (container, key, value) =>
    Reflect.set(
      new Proxy(container, {
        getPrototypeOf: () => null,
        getOwnPropertyDescriptor(target, key) {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
          return descriptor && { ...descriptor };
        },
      }),
      key,
      value
    ),
  defineProperty: (container, key, value) =>
    Reflect.defineProperty(
      container,
      key,
      Object.prototype.hasOwnProperty.call(container, key)
        ? { value }
        : { value, writable: true, enumerable: true, configurable: true }
    ),
  // `children` logs the keys the write gave the child
  child: (container, key, value, outer, raw, children) => {
    const child = Object.create(container);
    const result = Reflect.set(child, key, value);
    children.push(Object.keys(child).sort().join(","));
    return result;
  },
  other: (container, key, value, outer, raw, children, other) => Reflect.set(container, key, value, other),
  raw: (container, key, value, outer, raw) => Reflect.set(container, key, value, raw),
};
/** Routes whose receiver does not forward to the proxy. */
const nonForwarding = new Set(["child", "other", "raw"]);

// A define with a value replaces an accessor with data: it is no way to
// write through the accessor.
const setRoutes = Object.keys(routes).filter((route) => route !== "defineProperty");
const forwardingSetRoutes = setRoutes.filter((route) => !nonForwarding.has(route));
const forwardingRoutes = Object.keys(routes).filter((route) => !nonForwarding.has(route));

/** A route: mostly forwarding ones, so that most cases end with a replica equal to the container. */
const routeArbitrary = (forwarding) =>
  fc.oneof({ arbitrary: fc.constantFrom(...forwarding), weight: 8 }, { arbitrary: fc.constantFrom(...nonForwarding), weight: 1 });

const accessorWrite = fc.record({
  write: fc.record({ key: fc.constantFrom(...accessorKeys), value: valueArbitrary }),
  route: routeArbitrary(forwardingSetRoutes),
});

const arrayArbitrary = fc.record({
  kind: fc.constant("array"),
  items: fc.array(valueArbitrary, { maxLength: 5 }),
  bar: fc.option(valueArbitrary, { nil: null }),
  effects: fc.array(fc.uniqueArray(fc.constantFrom(...arrayReadKeys), { minLength: 1, maxLength: 4 }), {
    minLength: 1,
    maxLength: 4,
  }),
  writes: fc.array(
    fc.oneof(
      fc.record({
        write: fc.oneof(
          fc.record({ key: fc.constantFrom(...indexKeys, ...namedKeys), value: valueArbitrary }),
          fc.record({ key: fc.constant("length"), value: fc.integer({ min: 0, max: 6 }) })
        ),
        route: routeArbitrary(forwardingRoutes),
      }),
      accessorWrite
    ),
    { minLength: 1, maxLength: 12 }
  ),
});

const objectArbitrary = fc.record({
  kind: fc.constant("object"),
  // `a` and `b` from the first two items
  items: fc.array(valueArbitrary, { maxLength: 2 }),
  bar: fc.option(valueArbitrary, { nil: null }),
  effects: fc.array(fc.uniqueArray(fc.constantFrom(...objectReadKeys), { minLength: 1, maxLength: 4 }), {
    minLength: 1,
    maxLength: 4,
  }),
  writes: fc.array(
    fc.oneof(
      fc.record({
        write: fc.record({ key: fc.constantFrom(...fieldKeys, ...namedKeys), value: valueArbitrary }),
        route: routeArbitrary(forwardingRoutes),
      }),
      accessorWrite
    ),
    { minLength: 1, maxLength: 12 }
  ),
});

export const receiverArbitrary = fc.oneof(arrayArbitrary, objectArbitrary);

/** The container of `spec` (an instance of a class with the accessors) and its closures. */
function makeContainer(spec) {
  const closures = { hidden: undefined, ownHidden: undefined, ownSink: undefined };
  const inherited = {
    hidden: {
      get() {
        return closures.hidden;
      },
      set(value) {
        closures.hidden = value;
      },
      configurable: true,
    },
    mirror: {
      get() {
        return this.bar;
      },
      set(value) {
        this.bar = value;
        this.extra = value;
      },
      configurable: true,
    },
    sink: {
      set(value) {
        this.extra = value;
      },
      configurable: true,
    },
  };
  // not enumerable: a replica copies no accessor
  const own = {
    ownHidden: {
      get() {
        return closures.ownHidden;
      },
      set(value) {
        closures.ownHidden = value;
      },
      configurable: true,
    },
    ownMirror: {
      get() {
        return this.extra;
      },
      set(value) {
        this.extra = value;
        this.bar = value;
      },
      configurable: true,
    },
    ownSink: {
      set(value) {
        closures.ownSink = value;
      },
      configurable: true,
    },
  };
  let container;
  if (spec.kind === "object") {
    class Accessors {}
    Object.defineProperties(Accessors.prototype, inherited);
    container = new Accessors();
    spec.items.forEach((value, i) => (container[fieldKeys[i]] = materialize(value)));
  } else {
    class Accessors extends Array {}
    Object.defineProperties(Accessors.prototype, inherited);
    container = Accessors.from(spec.items.map(materialize));
  }
  if (spec.bar !== null) container.bar = materialize(spec.bar);
  Object.defineProperties(container, own);
  return { container, closures };
}

/** A spec value as the library gets it: a fresh object for each use. */
function materialize(value) {
  return value !== null && typeof value === "object" ? { ...value.object } : value;
}

function sameValue(a, b) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function describeValue(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

/**
 * What a replica can hold of `container`, as text: an array's length,
 * items (a hole reads as undefined, as an event fills it) and named keys;
 * an object's own enumerable keys and values.
 */
function describe(kind, container) {
  if (kind === "object") {
    return Object.keys(container)
      .sort()
      .map((key) => `${key}=${describeValue(container[key])}`)
      .join(" ");
  }
  const items = [];
  for (let i = 0; i < container.length; i++) items.push(describeValue(container[i]));
  return `length=${container.length} [${items.join(",")}] bar=${describeValue(container.bar)} extra=${describeValue(container.extra)}`;
}

/** In the model's changed keys: the object got a key, so each reader of a key reruns. */
const ANY_KEY = Symbol("any key");

/** Does a write of `spec` take the raw route? Its writes change the container and no replica. */
export function writesRaw(spec) {
  return spec.writes.some(({ route }) => route === "raw");
}

/**
 * The model: how often each effect runs, the keys each child write gives
 * its child, the container, and the replica.
 *
 * A data write lands where its receiver sends it: through the proxy (the
 * direct write and every forwarding route) it changes the container and the
 * replica, unless it changes nothing (the same value at a key the container
 * has, or a deep-equal object). On the raw container it changes the
 * container only. On a fresh child it changes neither. On the other proxy
 * of the state it changes that object and its replica, by the same rule.
 *
 * Through the proxy an index write that changes the array reruns the
 * readers of that index and of the whole array, and of `length` when it
 * makes the array longer; a length change reruns the readers of `length`,
 * of the whole array, and of each index it removes; a name reruns its
 * readers only. A key added to an object reruns every effect that read a
 * key of it (see `triggerKeyChange`).
 *
 * An accessor write: through the proxy, when the getter already gives the
 * value, nothing happens; a setter with no getter always runs. Else the
 * setter runs, its writes land as above with the receiver as `this`, and
 * the readers of its key rerun. Through another receiver the setter always
 * runs, and the readers of its key rerun when the getter gives another
 * value afterwards. A reader of `mirror` also reads `bar`, and a reader of
 * `ownMirror` reads `extra`. Each effect reruns at most once per write.
 */
export function model(spec) {
  const { container: source, closures } = makeContainer(spec);
  const replica = spec.kind === "object" ? { ...source } : Object.assign([...source], spec.bar !== null ? { bar: source.bar } : {});
  const runs = spec.effects.map(() => 1);
  // keys each child write gave its child, and whether a raw write came yet
  const children = [];
  let childKeys;
  let replicating = true;
  // `state.other`, a plain object, and its replica
  const other = {};
  const otherReplica = {};
  const reads = (read, changed) =>
    changed.has(read) ||
    changed.has(ANY_KEY) || (read === "mirror" && changed.has("bar")) || (read === "ownMirror" && changed.has("extra"));

  /** A data write of `key` through `landing` (proxy, raw or child). */
  const writeData = (changed, landing, key, value) => {
    if (landing === "child") {
      childKeys.add(key);
      return;
    }
    if (landing === "other") {
      // effects read only the container
      if (Object.prototype.hasOwnProperty.call(other, key) && sameValue(other[key], value)) return;
      other[key] = value;
      if (replicating) otherReplica[key] = value !== null && typeof value === "object" ? { ...value } : value;
      return;
    }
    if (landing === "raw") {
      if (key === "length") source.length = value;
      else source[key] = value;
      return;
    }
    if (key === "length") {
      const before = source.length;
      if (value !== before) {
        changed.add("length").add(ITERATE);
        for (let i = value; i < before; i++) changed.add(String(i));
        source.length = value;
        if (replicating) replica.length = value;
      }
      return;
    }
    const had = Object.prototype.hasOwnProperty.call(source, key);
    if (had && sameValue(source[key], value)) return;
    changed.add(key);
    // a key added to an object reruns every reader of the object's keys
    if (!had && spec.kind === "object") changed.add(ANY_KEY);
    if (indexKeys.includes(key)) {
      changed.add(ITERATE);
      if (Number(key) >= source.length) changed.add("length");
    }
    source[key] = value;
    if (replicating) replica[key] = value !== null && typeof value === "object" ? { ...value } : value;
  };
  const getter = {
    hidden: () => closures.hidden,
    mirror: () => source.bar,
    ownHidden: () => closures.ownHidden,
    ownMirror: () => source.extra,
  };
  const setter = {
    hidden: (changed, landing, value) => (closures.hidden = value),
    mirror: (changed, landing, value) => {
      writeData(changed, landing, "bar", value);
      writeData(changed, landing, "extra", value);
    },
    sink: (changed, landing, value) => writeData(changed, landing, "extra", value),
    ownHidden: (changed, landing, value) => (closures.ownHidden = value),
    ownMirror: (changed, landing, value) => {
      writeData(changed, landing, "extra", value);
      writeData(changed, landing, "bar", value);
    },
    ownSink: (changed, landing, value) => (closures.ownSink = value),
  };

  for (const { write, route } of spec.writes) {
    const { key } = write;
    const landing = nonForwarding.has(route) ? route : "proxy";
    const value = key === "length" ? write.value : materialize(write.value);
    const changed = new Set();
    childKeys = new Set();
    if (landing === "raw") replicating = false;
    if (accessorKeys.includes(key)) {
      const before = getterless.has(key) ? undefined : getter[key]();
      if (landing === "proxy") {
        if (getterless.has(key) || !sameValue(before, value)) {
          setter[key](changed, landing, value);
          changed.add(key);
        }
      } else {
        setter[key](changed, landing, value);
        // the library compares the getter's values by identity
        if ((getterless.has(key) ? undefined : getter[key]()) !== before) changed.add(key);
      }
    } else {
      writeData(changed, landing, key, value);
    }
    if (landing === "child") children.push([...childKeys].sort().join(","));
    spec.effects.forEach((keys, i) => {
      if (keys.some((read) => reads(read, changed))) runs[i]++;
    });
  }
  return {
    runs,
    children,
    source: describe(spec.kind, source),
    replica: describe(spec.kind, replica),
    other: describe("object", other),
    otherReplica: describe("object", otherReplica),
    closures: JSON.stringify(closures),
  };
}

/** The effect runs of the model (see `model`). */
export function modelRuns(spec) {
  return model(spec).runs;
}

/**
 * Runs `spec` on `lib`, each write through its route, or directly when
 * `direct` and the route forwards. Gives the events as JSON, the effect
 * runs, the write results, the keys each child write gave its child, the
 * container, the replica that applied the events, and the closures.
 */
export function runReceivers(lib, spec, direct) {
  const { reactive, watchEffect, updateState, toRaw } = lib;
  const kind = spec.kind ?? "array";
  const { container, closures } = makeContainer({ ...spec, kind });
  const raw = { container, other: {} };
  const remote = {
    other: {},
    container:
      kind === "object"
        ? structuredClone({ ...container })
        : Object.assign(structuredClone([...container]), spec.bar !== null ? { bar: structuredClone(container.bar) } : {}),
  };
  const events = [];
  const children = [];
  let recording = false;
  let replicating = true;
  const state = reactive(raw, (event) => {
    if (!recording) return;
    const wire = structuredClone(event);
    events.push(JSON.stringify(wire));
    if (replicating) updateState(remote, wire);
  });
  const proxy = state.container;
  const outer = new Proxy(proxy, {});
  const other = state.other;
  const runs = spec.effects.map(() => 0);
  const stops = spec.effects.map((reads, i) =>
    watchEffect(() => {
      runs[i]++;
      for (const read of reads) {
        if (read === ITERATE) for (const item of proxy) item;
        else proxy[read];
      }
    })
  );
  recording = true;
  const results = [];
  try {
    for (const { write, route } of spec.writes) {
      const used = direct && !nonForwarding.has(route) ? "direct" : route;
      if (route === "raw") replicating = false;
      results.push(routes[used](proxy, write.key, materialize(write.value), outer, toRaw(proxy), children, other));
    }
  } finally {
    for (const stop of stops) stop();
  }
  return {
    events,
    runs,
    results,
    children,
    source: describe(kind, toRaw(proxy)),
    replica: describe(kind, remote.container),
    other: describe("object", toRaw(other)),
    otherReplica: describe("object", remote.other),
    closures: JSON.stringify(closures),
  };
}
