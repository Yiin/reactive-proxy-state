// The events a replica receives for a matrix of writes, as text. Shared by
// tests/event-stream.bun.test.ts, which compares the source with
// tests/fixtures/events-3.0.2.json, and tests/event-stream.record.mjs, which
// records that file from a published bundle. Effect fixes must not change
// what a replica receives: every write here emits what 3.0.2 emitted.

/** Text of a value: types, holes, -0, NaN, Maps, Sets, proxies and objects seen twice in one event. */
function encode(lib, value, seen) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  switch (typeof value) {
    case "number":
      return Object.is(value, -0) ? "-0" : String(value);
    case "string":
      return JSON.stringify(value);
    case "bigint":
      return `${value}n`;
    case "symbol":
      return String(value);
    case "function":
      return "function";
    case "boolean":
      return String(value);
  }
  if (seen.has(value)) return `#${seen.get(value)}`;
  const id = seen.size;
  seen.set(value, id);
  const proxy = lib.isReactive(value) ? "proxy " : "";
  if (value instanceof Date) return `${proxy}Date(${value.getTime()})#${id}`;
  if (value instanceof Map) {
    const entries = [...value].map(([key, item]) => `${encode(lib, key, seen)}=>${encode(lib, item, seen)}`);
    return `${proxy}Map{${entries.join(",")}}#${id}`;
  }
  if (value instanceof Set) return `${proxy}Set{${[...value].map((item) => encode(lib, item, seen)).join(",")}}#${id}`;
  const parts = [];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) parts.push(i in value ? encode(lib, value[i], seen) : "<hole>");
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length" || (typeof key === "string" && String(Number(key) >>> 0) === key)) continue;
      parts.push(`${String(key)}:${encode(lib, value[key], seen)}`);
    }
    return `${proxy}[${parts.join(",")}]#${id}`;
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    const mark = descriptor.enumerable ? "" : "~";
    parts.push(`${mark}${typeof key === "symbol" ? String(key) : JSON.stringify(key)}:${"value" in descriptor ? encode(lib, descriptor.value, seen) : "accessor"}`);
  }
  return `${proxy}{${parts.join(",")}}#${id}`;
}

/** Text of one event, its fields in a fixed order. */
function eventText(lib, event) {
  const seen = new Map();
  const fields = Object.keys(event).sort().map((field) => `${field}=${encode(lib, event[field], seen)}`);
  return fields.join(" ");
}

class Item {
  constructor(id) {
    this.id = id;
  }
}

/** A holder whose `value` is an own setter: the set itself emits nothing. */
function withSetter() {
  const holder = { stored: 1 };
  Object.defineProperty(holder, "value", {
    get() {
      return this.stored;
    },
    set(value) {
      this.stored = value;
    },
    enumerable: true,
    configurable: true,
  });
  return holder;
}

const items = () => [{ id: 1 }, { id: 2 }, { id: 3 }];

/** Writes to an array `list`, as in tests/array-effects.bun.test.ts, and more. */
const arrayWrites = {
  "index set": (list) => (list[0] = { id: 9 }),
  "index set of a primitive": (list) => (list[1] = 5),
  "index set to the same object": (list) => (list[0] = list[0]),
  "index set to an equal object": (list) => (list[0] = { id: 1 }),
  "index set past the end": (list) => (list[3] = { id: 9 }),
  "index set far past the end": (list) => (list[5] = { id: 9 }),
  "index set to undefined past the end": (list) => (list[3] = undefined),
  "index delete": (list) => delete list[0],
  "last index delete": (list) => delete list[2],
  "delete of a missing index": (list) => delete list[7],
  "shorter length": (list) => (list.length = 1),
  "length 0": (list) => (list.length = 0),
  "longer length": (list) => (list.length = 5),
  "same length": (list) => (list.length = 3),
  "named property": (list) => (list.label = "x"),
  push: (list) => list.push({ id: 9 }),
  "push of two": (list) => list.push({ id: 8 }, 7),
  "push of nothing": (list) => list.push(),
  pop: (list) => list.pop(),
  shift: (list) => list.shift(),
  unshift: (list) => list.unshift({ id: 9 }),
  "unshift of nothing": (list) => list.unshift(),
  "splice removes": (list) => list.splice(0, 1),
  "splice inserts": (list) => list.splice(1, 0, { id: 9 }),
  "splice replaces": (list) => list.splice(1, 1, { id: 9 }),
  "splice with no arguments": (list) => list.splice(),
  "splice with a start only": (list) => list.splice(1),
  "splice from the end": (list) => list.splice(-1, 1, { id: 9 }, { id: 8 }),
  reverse: (list) => list.reverse(),
  sort: (list) => list.sort((a, b) => b.id - a.id),
  "sort that changes nothing": (list) => list.sort((a, b) => a.id - b.id),
  fill: (list) => list.fill({ id: 9 }, 0, 1),
  "fill of all": (list) => list.fill(0),
  copyWithin: (list) => list.copyWithin(0, 1),
  "write through an item": (list) => (list[1].id = 20),
  "write through an item after a shift": (list) => {
    const item = list[2];
    list.shift();
    item.id = 30;
  },
  "write through an item after a reverse": (list) => {
    const item = list[0];
    list.reverse();
    item.id = 10;
  },
  "a run of writes": (list) => {
    list.push({ id: 4 });
    list[0].id = 11;
    list.splice(1, 1);
    list.unshift(0);
    list.length = 2;
    list.sort();
  },
};

/** Where the array sits. */
const arrayPlaces = {
  "in an object": (raw) => ({ root: { list: raw }, list: (state) => state.list }),
  "as the root": (raw) => ({ root: raw, list: (state) => state }),
  "nested in an array": (raw) => ({ root: { rows: [[0], raw] }, list: (state) => state.rows[1] }),
  "at two places": (raw) => ({ root: { a: raw, b: { inner: raw } }, list: (state) => state.b.inner }),
};

const objectWrites = {
  "set of a held key": (state) => (state.obj.a = 2),
  "set of the same value": (state) => (state.obj.a = 1),
  "set of a new key": (state) => (state.obj.z = 1),
  "set of a new key to undefined": (state) => (state.obj.z = undefined),
  "set of an object": (state) => (state.obj.nested = { x: [1, 2], m: new Map([["k", { v: 1 }]]) }),
  "set of an equal object": (state) => (state.obj.child = { c: 1 }),
  "set of a changed object": (state) => (state.obj.child = { c: 2 }),
  "nested set": (state) => (state.obj.child.c = 5),
  "nested new key": (state) => (state.obj.child.d = 6),
  delete: (state) => delete state.obj.a,
  "delete of a missing key": (state) => delete state.obj.q,
  "delete of an object": (state) => delete state.obj.child,
  "set of a symbol key": (state) => (state.obj[Symbol.for("rps.key")] = 1),
  "replace of the object": (state) => (state.obj = { fresh: true }),
  "set of a date": (state) => (state.obj.when = new Date(0)),
  "set through a setter": (state) => (state.setter.value = 7),
  "set of a class instance": (state) => (state.obj.item = new Item(4)),
  "write through a class instance": (state) => (state.instance.id = 8),
  "write through an alias": (state) => (state.alias.second.c = 9),
  "a spread back in": (state) => (state.obj = { ...state.obj, a: 3 }),
  "a run of writes": (state) => {
    state.obj.z = 1;
    state.obj.child.c = 2;
    delete state.obj.a;
    state.obj.list = [state.obj.child];
    state.obj.child.c = 3;
  },
};

function objectRoot() {
  const child = { c: 1 };
  return { obj: { a: 1, child }, setter: withSetter(), instance: new Item(1), alias: { first: child, second: child } };
}

const mapWrites = {
  "getOrInsert new": map => map.getOrInsert("z", 9),
  "getOrInsert undefined": map => map.getOrInsert("z", undefined),
  "getOrInsert existing": map => map.getOrInsert("a", 9),
  "getOrInsert object": map => { map.getOrInsert("z", { id: 1 }).id = 2; },
  "getOrInsertComputed new": map => map.getOrInsertComputed("z", () => 9),
  "getOrInsertComputed undefined": map => map.getOrInsertComputed("z", () => undefined),
  "getOrInsertComputed existing": map => map.getOrInsertComputed("a", () => { throw Error("must not run"); }),
  "getOrInsertComputed object": map => { map.getOrInsertComputed("z", () => ({ id: 1 })).id = 2; },

  "set of a held key": (map) => map.set("a", 5),
  "set of the same value": (map) => map.set("a", 1),
  "set of a new key": (map) => map.set("z", 9),
  "set of a new key to undefined": (map) => map.set("z", undefined),
  "set of an object value": (map) => map.set("o", { id: 1 }),
  "set of an equal object value": (map) => map.set("obj", { id: 1 }),
  "set of an object key": (map) => map.set({ key: 1 }, "v"),
  "set of a held object key": (map, keys) => map.set(keys.held, "w"),
  "set of a NaN key": (map) => map.set(NaN, 1),
  "set of -0": (map) => map.set(-0, 1),
  delete: (map) => map.delete("a"),
  "delete of a missing key": (map) => map.delete("q"),
  "delete of an object key": (map, keys) => map.delete(keys.held),
  clear: (map) => map.clear(),
  "write through a value": (map) => (map.get("obj").id = 2),
  "write through a value from values()": (map) => {
    for (const value of map.values()) if (value !== null && typeof value === "object") value.id = 3;
  },
  "a run of writes": (map) => {
    map.set("z", 1);
    map.delete("a");
    map.get("obj").id = 4;
    map.set("obj", { id: 5 });
    map.clear();
    map.set("a", 1);
  },
};

function mapRaw() {
  const held = { key: 0 };
  return { raw: new Map([["a", 1], ["obj", { id: 1 }], [held, "h"], [0, "zero"]]), keys: { held } };
}

const setWrites = {
  "add of a new value": (set) => set.add(9),
  "add of a held value": (set) => set.add(1),
  "add of an object": (set) => set.add({ id: 7 }),
  "add of a held object": (set, members) => set.add(members.held),
  "add of NaN": (set) => set.add(NaN),
  delete: (set) => set.delete(1),
  "delete of a missing value": (set) => set.delete(42),
  "delete of an object": (set, members) => set.delete(members.held),
  clear: (set) => set.clear(),
  "write through a member": (set) => {
    for (const member of set) if (member !== null && typeof member === "object") member.id = 5;
  },
  "a run of writes": (set) => {
    set.add(2);
    set.delete(1);
    set.add({ id: 3 });
    set.clear();
    set.add(1);
  },
};

function setRaw() {
  const held = { id: 1 };
  return { raw: new Set([1, "1", held]), members: { held } };
}

/** Run `write` on a fresh root and return the events its listener got, as text, or how it threw. */
async function record(lib, makeRoot, write, options) {
  const events = [];
  const state = lib.reactive(makeRoot(), (event) => events.push(eventText(lib, event)), [], options);
  try {
    write(state);
  } catch (error) {
    events.push(`throws ${error.name}: ${error.message}`);
  }
  if (options?.async) await new Promise((resolve) => setTimeout(resolve, 0));
  return events;
}

/** Each case's events, by case name. */
export async function recordEvents(lib) {
  const cases = {};
  const modes = { sync: undefined, async: { async: true } };
  for (const [modeName, options] of Object.entries(modes)) {
    for (const [placeName, place] of Object.entries(arrayPlaces)) {
      for (const [writeName, write] of Object.entries(arrayWrites)) {
        const { root, list } = place(items());
        cases[`${modeName} array ${placeName}: ${writeName}`] = await record(lib, () => root, (state) => write(list(state)), options);
      }
    }
    for (const [writeName, write] of Object.entries(objectWrites)) {
      cases[`${modeName} object: ${writeName}`] = await record(lib, objectRoot, write, options);
    }
    for (const [writeName, write] of Object.entries(mapWrites)) {
      let keys;
      cases[`${modeName} map: ${writeName}`] = await record(
        lib,
        () => {
          const made = mapRaw();
          keys = made.keys;
          return { map: made.raw };
        },
        (state) => write(state.map, keys),
        options
      );
    }
    for (const [writeName, write] of Object.entries(setWrites)) {
      let members;
      cases[`${modeName} set: ${writeName}`] = await record(
        lib,
        () => {
          const made = setRaw();
          members = made.members;
          return { set: made.raw };
        },
        (state) => write(state.set, members),
        options
      );
    }
  }
  Object.assign(cases, await effectCases(lib));
  return cases;
}

/**
 * Writes made by effects, and by a listener while it receives an event.
 * No computed values: 3.0.2 sent stale derived values for those (fixed in
 * 3.0.3), so they are tested on their own.
 */
async function effectCases(lib) {
  const cases = {};
  const run = (name, makeRoot, setup, write) => {
    const events = [];
    const state = lib.reactive(makeRoot(), (event) => events.push(eventText(lib, event)));
    const stops = setup(state);
    try {
      write(state);
    } catch (error) {
      events.push(`throws ${error.name}: ${error.message}`);
    }
    for (const stop of stops) stop();
    cases[`effect: ${name}`] = events;
  };
  run(
    "a mirror of a key",
    () => ({ count: 0, copy: 0 }),
    (state) => [lib.watchEffect(() => (state.copy = state.count * 2))],
    (state) => {
      state.count = 1;
      state.count = 2;
    }
  );
  run(
    "a sum of an array",
    () => ({ list: [1, 2, 3], sum: 0 }),
    (state) => [lib.watchEffect(() => (state.sum = state.list.reduce((sum, value) => sum + value, 0)))],
    (state) => {
      state.list.push(4);
      state.list[0] = 10;
      state.list.splice(1, 1);
      state.list.length = 1;
    }
  );
  run(
    "a size of a map and a set",
    () => ({ map: new Map([["a", 1]]), set: new Set([1]), sizes: [0, 0] }),
    (state) => [lib.watchEffect(() => (state.sizes = [state.map.size, state.set.size]))],
    (state) => {
      state.map.set("b", 2);
      state.set.add(2);
      state.map.delete("a");
      state.set.clear();
    }
  );
  run(
    "two effects that count and copy",
    () => ({ count: 0, seen: 0 }),
    (state) => [lib.watchEffect(() => state.count++), lib.watchEffect(() => (state.seen = state.count))],
    (state) => {
      state.count = 5;
    }
  );
  run(
    "an effect over items that writes each",
    () => ({ items: [{ done: false }, { done: false }], total: 0 }),
    (state) => [lib.watchEffect(() => (state.total = state.items.filter((item) => item.done).length))],
    (state) => {
      state.items[0].done = true;
      state.items.push({ done: true });
      state.items[1].done = true;
    }
  );
  {
    const events = [];
    let nested = true;
    const state = lib.reactive({ a: 0, b: 0, list: [] }, (event) => {
      events.push(eventText(lib, event));
      if (nested && event.path[0] === "a") {
        nested = false;
        state.b = 1;
        state.list.push(state.a);
      }
    });
    state.a = 1;
    state.a = 2;
    cases["listener: writes while it receives an event"] = events;
  }
  return cases;
}
