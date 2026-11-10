// Random writes to an array proxy made through other receivers (3.0.13).
// Each write lands on the array, so each must send the events and rerun the
// effects that the same write made directly on the proxy sends and reruns,
// and the effect runs must match a model of the write semantics.
import fc from "fast-check";

/** The array as a whole: what `for...of` reads. */
export const ITERATE = "iterate";
const indexKeys = ["0", "1", "2", "3", "4", "5"];
const namedKeys = ["bar", "extra"];
const readKeys = [...indexKeys, "length", ...namedKeys, ITERATE];

/** Item values: equal primitives, a hole-like undefined, and deep-equal objects. */
const valueArbitrary = fc.oneof(
  fc.constantFrom(0, 1, 2, undefined),
  fc.integer({ min: 0, max: 1 }).map((n) => ({ object: { n } }))
);

/**
 * Ways to write `list[key] = value`. Each receiver forwards to the proxy,
 * so the write lands on the array.
 */
export const routes = {
  direct: (list, key, value) => Reflect.set(list, key, value),
  outer: (list, key, value, outer) => Reflect.set(outer, key, value),
  outerOfOuter: (list, key, value, outer) => Reflect.set(new Proxy(outer, {}), key, value),
  forwardingSetTrap: (list, key, value) =>
    Reflect.set(new Proxy(list, { set: (target, key, value, receiver) => Reflect.set(target, key, value, receiver) }), key, value),
  reflectWithOuterReceiver: (list, key, value, outer) => Reflect.set(list, key, value, outer),
  assignToOuter: (list, key, value, outer) => {
    outer[key] = value;
    return true;
  },
  defineProperty: (list, key, value) =>
    Reflect.defineProperty(
      list,
      key,
      Object.prototype.hasOwnProperty.call(list, key)
        ? { value }
        : { value, writable: true, enumerable: true, configurable: true }
    ),
};

const writeArbitrary = fc.oneof(
  fc.record({ key: fc.constantFrom(...indexKeys, ...namedKeys), value: valueArbitrary }),
  fc.record({ key: fc.constant("length"), value: fc.integer({ min: 0, max: 6 }) })
);

export const receiverArbitrary = fc.record({
  items: fc.array(valueArbitrary, { maxLength: 5 }),
  bar: fc.option(valueArbitrary, { nil: null }),
  effects: fc.array(fc.uniqueArray(fc.constantFrom(...readKeys), { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 4 }),
  writes: fc.array(
    fc.record({ write: writeArbitrary, route: fc.constantFrom(...Object.keys(routes)) }),
    { minLength: 1, maxLength: 12 }
  ),
});

/** A spec value as the library gets it: a fresh object for each use. */
function materialize(value) {
  return value !== null && typeof value === "object" ? { ...value.object } : value;
}

function sameValue(a, b) {
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

/**
 * The model: how often each effect runs. A write that changes nothing (the
 * same value at a key the array has, or a deep-equal object) reruns
 * nothing. An index write that changes the array reruns the readers of that
 * index and of the whole array, and of `length` when it makes the array
 * longer. A length change reruns the readers of `length`, of the whole
 * array, and of each index it removes. A name reruns its readers only.
 * Each effect reruns at most once per write.
 */
export function modelRuns(spec) {
  const model = spec.items.map(materialize);
  if (spec.bar !== null) model.bar = materialize(spec.bar);
  const runs = spec.effects.map(() => 1);
  for (const { write } of spec.writes) {
    const { key } = write;
    const changed = new Set();
    if (key === "length") {
      const before = model.length;
      if (write.value !== before) {
        changed.add("length").add(ITERATE);
        for (let i = write.value; i < before; i++) changed.add(String(i));
        model.length = write.value;
      }
    } else {
      const value = materialize(write.value);
      if (!(key in model && sameValue(model[key], value))) {
        changed.add(key);
        if (indexKeys.includes(key)) {
          changed.add(ITERATE);
          if (Number(key) >= model.length) changed.add("length");
        }
        model[key] = value;
      }
    }
    spec.effects.forEach((reads, i) => {
      if (reads.some((read) => changed.has(read))) runs[i]++;
    });
  }
  return runs;
}

/**
 * Runs `spec` on `lib`, each write through its route, or directly when
 * `direct`. Gives the events as JSON, the effect runs, the array, and the
 * failures of a replica that applied the events.
 */
export function runReceivers(lib, spec, direct) {
  const { reactive, watchEffect, updateState, toRaw } = lib;
  const items = spec.items.map(materialize);
  if (spec.bar !== null) items.bar = materialize(spec.bar);
  const raw = { list: items };
  const remote = { list: structuredClone(items) };
  if (spec.bar !== null) remote.list.bar = structuredClone(items.bar);
  const events = [];
  let recording = false;
  const state = reactive(raw, (event) => {
    if (!recording) return;
    const wire = structuredClone(event);
    events.push(JSON.stringify(wire));
    updateState(remote, wire);
  });
  const list = state.list;
  const outer = new Proxy(list, {});
  const runs = spec.effects.map(() => 0);
  const stops = spec.effects.map((reads, i) =>
    watchEffect(() => {
      runs[i]++;
      for (const read of reads) {
        if (read === ITERATE) for (const item of list) item;
        else list[read];
      }
    })
  );
  recording = true;
  const results = [];
  try {
    for (const { write, route } of spec.writes) {
      results.push(routes[direct ? "direct" : route](list, write.key, materialize(write.value), outer));
    }
  } finally {
    for (const stop of stops) stop();
  }
  const array = toRaw(list);
  const replica = [];
  if (remote.list.length !== array.length) replica.push(`length ${remote.list.length} != ${array.length}`);
  for (let i = 0; i < array.length; i++) {
    if (!sameValue(remote.list[i], array[i])) replica.push(`index ${i}`);
  }
  for (const key of namedKeys) if (!sameValue(remote.list[key], array[key])) replica.push(key);
  return { events, runs, results, array: JSON.stringify([...array, array.bar, array.extra]), replica };
}
