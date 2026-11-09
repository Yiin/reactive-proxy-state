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
export function eventText(lib, event) {
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

/**
 * Writes for `recordListenerWrites`, what an effect reads of what each
 * changes, and how an effect writes it back. "a longer length" and "an
 * alias write" send several events.
 */
const listenerWrites = {
  "object set": { write: (s) => (s.x = 15), read: (s) => s.x, fix: (s) => { if (s.x > 10) s.x = 10; } },
  "object add": { write: (s) => (s.o.z = 1), read: (s) => JSON.stringify(s.o), fix: (s) => { if (s.o.z === 1) s.o.z = 2; } },
  "object delete": { write: (s) => delete s.o.k, read: (s) => JSON.stringify(s.o), fix: (s) => { if (JSON.stringify(s.o) === "{}") s.o.k = 0; } },
  "array push": { write: (s) => s.list.push(4), read: (s) => s.list.join(), fix: (s) => { if (s.list.length > 3) s.list.splice(0, s.list.length - 3); } },
  "array splice": { write: (s) => s.list.splice(0, 1), read: (s) => s.list.join(), fix: (s) => { if (s.list.length < 3) s.list.push(0); } },
  "a longer length": { write: (s) => (s.list.length = 5), read: (s) => s.list.length, fix: (s) => { if (s.list.length > 3) s.list.length = 3; } },
  "map set": { write: (s) => s.map.set("a", 5), read: (s) => s.map.get("a"), fix: (s) => { if (s.map.get("a") > 2) s.map.set("a", 2); } },
  "set add": { write: (s) => s.set.add(9), read: (s) => s.set.size, fix: (s) => { if (s.set.size > 1) s.set.delete(9); } },
  "an alias write": { write: (s) => (s.o.k = 3), read: (s) => s.o.k, fix: (s) => { if (s.o.k > 2) s.o.k = 2; } },
};

/**
 * What the listener does with each event of the write: it stamps
 * `version` before it forwards (with a number it counts, or with
 * `version++`, which reads it), or after.
 */
const listenerStyles = {
  "stamps before it forwards": (s, forward, count) => { s.version = count; forward(); },
  "bumps version before it forwards": (s, forward) => { s.version++; forward(); },
  "stamps after it forwards": (s, forward, count) => { forward(); s.version = count; },
};

const listenerEffects = {
  "no effect": () => {},
  "an effect that copies what the write changed": (s, { read }) => { s.copy = JSON.stringify(read(s)); },
  "an effect that writes back what the write changed": (s, { fix }) => fix(s),
  "an effect that throws": (s, { read }, armed) => { read(s); if (armed()) throw new Error("effect failed"); },
  "an effect that reads the stamp": (s) => { s.copy = String(s.version); },
};

/**
 * Each case's events when a listener writes `version` while it receives
 * the events of a write, and an effect reads, writes or throws. The last
 * line says whether the replica that applied the events equals the source.
 */
export function recordListenerWrites(lib) {
  const cases = {};
  for (const [writeName, change] of Object.entries(listenerWrites)) {
    for (const [styleName, style] of Object.entries(listenerStyles)) {
      for (const [effectName, effect] of Object.entries(listenerEffects)) {
        const events = [];
        let armed = false;
        let count = 0;
        let remote;
        const o = { k: 1 };
        const raw = { x: 0, version: 0, copy: "", o, list: [1, 2, 3], map: new Map([["a", 1]]), set: new Set([1]) };
        if (writeName === "an alias write") raw.o2 = o;
        const state = lib.reactive(raw, (event) => {
          if (event.path.length === 0) {
            remote = event.newValue;
            return;
          }
          const forward = () => {
            events.push(eventText(lib, event));
            lib.updateState(remote, event);
          };
          if (!armed || event.path[0] === "version") forward();
          else style(state, forward, ++count);
        });
        const stop = lib.watchEffect(() => effect(state, change, () => armed));
        armed = true;
        try {
          change.write(state);
        } catch (error) {
          events.push(`throws ${error.message}`);
        }
        stop();
        const same = JSON.stringify(lib.deepToRaw(state), replicaText) === JSON.stringify(remote, replicaText);
        events.push(same ? "replica equals the source" : "replica differs from the source");
        cases[`listener ${styleName}, ${effectName}: ${writeName}`] = events;
      }
    }
  }
  return cases;
}

/** JSON of a state with its Maps and Sets. */
function replicaText(_key, value) {
  if (value instanceof Map) return { map: [...value] };
  if (value instanceof Set) return { set: [...value] };
  return value;
}

/** Writes for `recordWideWrites`: each sends more than 100 events, or runs more than 100 effect writes. */
const WIDE = 150;
const wideWrites = {
  "a length grow past 100": {
    init: () => ({ list: [] }),
    write: (s) => (s.list.length = WIDE),
  },
  "an alias at 150 places": {
    init: () => { const shared = { n: 0 }; return { list: Array.from({ length: WIDE }, () => shared) }; },
    write: (s) => (s.list[0].n = 1),
  },
  "an effect that writes 150 items": {
    init: () => ({ trigger: 0, items: Array.from({ length: WIDE }, () => ({ done: false })) }),
    effects: (lib, s) => [lib.watchEffect(() => { if (s.trigger !== 0) for (const item of s.items) item.done = true; })],
    write: (s) => (s.trigger = 1),
  },
  "150 effects that write once each": {
    init: () => ({ trigger: 0, out: Array.from({ length: WIDE }, () => 0) }),
    effects: (lib, s) => Array.from({ length: WIDE }, (_, index) => lib.watchEffect(() => { if (s.trigger !== 0) s.out[index] = s.trigger; })),
    write: (s) => (s.trigger = 1),
  },
};

/** How the listener stamps `version` for each event other than its own. */
const wideStyles = {
  "stamps before it forwards": (s, forward, count) => { s.version = count; forward(); },
  "bumps version before it forwards": (s, forward) => { try { s.version++; } finally { forward(); } },
  "stamps after it forwards": (s, forward, count) => { forward(); s.version = count; },
  "bumps version after it forwards": (s, forward) => { forward(); s.version++; },
};

/**
 * Finite fan-out with a listener that stamps every event, as the upgrade
 * guide shows, on sync and async roots (`roots` lists which, `true` for
 * async). 3.0.6 sends every event; 3.0.7 threw after 100 listener writes.
 * The last line says whether the replica equals the source.
 */
export async function recordWideWrites(lib, roots = [false, true]) {
  const cases = {};
  for (const async of roots) {
    for (const [writeName, change] of Object.entries(wideWrites)) {
      for (const [styleName, style] of Object.entries(wideStyles)) {
        const events = [];
        let armed = false;
        let count = 0;
        let remote;
        const state = lib.reactive({ ...change.init(), version: 0 }, (event) => {
          if (event.path.length === 0) {
            remote = event.newValue;
            return;
          }
          const forward = () => {
            events.push(eventText(lib, event));
            lib.updateState(remote, event);
          };
          if (!armed || event.path[0] === "version") forward();
          else style(state, forward, ++count);
        }, [], { async });
        if (async) await new Promise((resolve) => setTimeout(resolve, 0));
        const stops = change.effects?.(lib, state) ?? [];
        if (async) await new Promise((resolve) => setTimeout(resolve, 0));
        armed = true;
        const logged = [];
        const log = console.error;
        console.error = (error) => { logged.push(error instanceof Error ? error.message : String(error)); };
        try {
          change.write(state);
          if (async) await new Promise((resolve) => setTimeout(resolve, 0));
        } catch (error) {
          events.push(`throws ${error.message}`);
        } finally {
          console.error = log;
        }
        for (const message of logged) events.push(`logs ${message}`);
        for (const stop of stops) stop();
        const same = JSON.stringify(lib.deepToRaw(state), replicaText) === JSON.stringify(remote, replicaText);
        events.push(`version ${lib.toRaw(state).version}, ${same ? "replica equals the source" : "replica differs from the source"}`);
        cases[`${async ? "async" : "sync"} listener ${styleName}: ${writeName}`] = events;
      }
    }
  }
  return cases;
}
