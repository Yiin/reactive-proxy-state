import { describe, expect, test } from "bun:test";
import { reactive, toRaw, watchEffect } from "../src/index";
import { replicate } from "./replica";

/**
 * An effect that reads a Map or a Set reruns after every write that changes
 * what it read, once per write. 3.0.1 and earlier missed some: a `set` of
 * a key the map held did not rerun `values()`, `entries()`, `forEach` or a
 * loop; a `set` of a new key did not rerun `get` of that key; `clear()` did
 * not rerun `get`; `has` tracked the collection only the first time it was
 * read, so a later `has` missed an `add`; and an effect that read the
 * entries and the size ran twice per write.
 */

type Read = (collection: any) => unknown;
type Write = (collection: any) => unknown;

const mapReaders: Record<string, Read> = {
  get: (map) => [map.get("a"), map.get("z")],
  has: (map) => [map.has("a"), map.has("z")],
  size: (map) => map.size,
  "keys()": (map) => [...map.keys()],
  "values()": (map) => [...map.values()],
  "entries()": (map) => [...map.entries()],
  forEach: (map) => {
    const seen: unknown[] = [];
    map.forEach((value: unknown, key: unknown) => seen.push([key, value]));
    return seen;
  },
  "for...of": (map) => {
    const seen: unknown[] = [];
    for (const entry of map) seen.push(entry);
    return seen;
  },
};

const mapWrites: Record<string, Write> = {
  "set of a held key": (map) => map.set("a", 5),
  "set of a new key": (map) => map.set("z", 9),
  "set of a new key to undefined": (map) => map.set("z", undefined),
  delete: (map) => map.delete("a"),
  clear: (map) => map.clear(),
};

const setReaders: Record<string, Read> = {
  has: (set) => [set.has(1), set.has(9)],
  size: (set) => set.size,
  "values()": (set) => [...set.values()],
  "keys()": (set) => [...set.keys()],
  "entries()": (set) => [...set.entries()],
  forEach: (set) => {
    const seen: unknown[] = [];
    set.forEach((value: unknown) => seen.push(value));
    return seen;
  },
  "for...of": (set) => [...set],
};

const setWrites: Record<string, Write> = {
  "add of a new value": (set) => set.add(9),
  "add of a held value": (set) => set.add(1),
  delete: (set) => set.delete(1),
  clear: (set) => set.clear(),
};

/** Where the collection sits in the state. */
const placements: Record<string, (collection: object) => () => any> = {
  "in an object": (collection) => {
    const state = reactive({ collection }, () => {});
    return () => state.collection;
  },
  "in an array": (collection) => {
    const state = reactive({ list: [{}, collection] }, () => {});
    return () => state.list[1];
  },
  "as the root": (collection) => {
    const state = reactive(collection, () => {});
    return () => state;
  },
};

function show(read: () => unknown): string {
  return JSON.stringify(read()) ?? "undefined";
}

/** The entries of a raw Map or Set: [key, value, ...] or [value, ...], in order. */
const entriesOf = (collection: any): unknown[] =>
  collection instanceof Map ? [...collection].flat() : [...collection];

/** Is the entry `key` the same in `before` and `after`: held or not, and the same value (as `Object.is` tells)? */
const sameEntry = (before: any, after: any, key: unknown) =>
  before.has(key) === after.has(key) && (!(before instanceof Map) || Object.is(before.get(key), after.get(key)));

/**
 * Did what a reader read change from `before` to `after` (raw copies)?
 * The readers not named here read every entry, in order.
 */
const changedFor: Record<string, (before: any, after: any) => boolean> = {
  get: (before, after) => !sameEntry(before, after, "a") || !sameEntry(before, after, "z"),
  "has (Map)": (before, after) => !sameEntry(before, after, "a") || !sameEntry(before, after, "z"),
  "has (Set)": (before, after) => !sameEntry(before, after, 1) || !sameEntry(before, after, 9),
  size: (before, after) => before.size !== after.size,
};

function changedAll(before: any, after: any): boolean {
  const left = entriesOf(before);
  const right = entriesOf(after);
  return left.length !== right.length || left.some((value, index) => !Object.is(value, right[index]));
}

const copyOf = (collection: any) => (collection instanceof Map ? new Map(collection) : new Set(collection));

function matrix(kind: string, make: () => object, readers: Record<string, Read>, writes: Record<string, Write>) {
  describe(`an effect over a ${kind} reruns once after each write that changes what it read`, () => {
    for (const [writeName, write] of Object.entries(writes)) {
      describe(writeName, () => {
        for (const [readerName, read] of Object.entries(readers)) {
          test(readerName, () => {
            for (const [placementName, place] of Object.entries(placements)) {
              const collection = place(make());
              // `has` and `get` read once before the effect: the method is cached then
              read(collection());
              let seen = "";
              let runs = 0;
              const stop = watchEffect(() => {
                runs++;
                seen = show(() => read(collection()));
              });
              const before = copyOf(toRaw(collection()));
              write(collection());
              stop();
              const after = copyOf(toRaw(collection()));
              const fresh = show(() => read(collection()));
              expect({ placement: placementName, seen }).toEqual({ placement: placementName, seen: fresh });
              // once when what it read changed, else not at all
              const reruns = runs - 1;
              const name = readerName === "has" ? `has (${kind})` : readerName;
              const changed = Object.hasOwn(changedFor, name) ? changedFor[name] : changedAll;
              const expected = changed(before, after) ? 1 : 0;
              expect({ placement: placementName, reruns }).toEqual({ placement: placementName, reruns: expected });
            }
          });
        }
      });
    }

    for (const [writeName, write] of Object.entries(writes)) {
      test(`an effect that reads every part runs once after: ${writeName}`, () => {
        const collection = placements["in an object"](make());
        let runs = 0;
        watchEffect(() => {
          runs++;
          for (const read of Object.values(readers)) read(collection());
        });
        const before = copyOf(toRaw(collection()));
        write(collection());
        const after = copyOf(toRaw(collection()));
        expect(runs).toBe(changedAll(before, after) ? 2 : 1);
      });
    }
  });
}

matrix("Map", () => new Map<string, number>([["a", 1], ["b", 2]]), mapReaders, mapWrites);
matrix("Set", () => new Set<number>([1, 2]), setReaders, setWrites);

describe("an effect over a Map reruns only for what it read", () => {
  const writes: Record<string, Write> = {
    "set of another held key": (map) => map.set("b", 5),
    "set of another new key": (map) => map.set("z", 9),
    "delete of another key": (map) => map.delete("b"),
  };
  for (const [name, write] of Object.entries(writes)) {
    test(`get and has of a key do not rerun after: ${name}`, () => {
      const state = reactive({ map: new Map([["a", 1], ["b", 2]]) }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.map.get("a");
        state.map.has("a");
      });
      write(state.map);
      expect(runs).toBe(1);
    });
  }

  test("size does not rerun after a set of a held key", () => {
    const state = reactive({ map: new Map([["a", 1]]) }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.map.size;
    });
    state.map.set("a", 2);
    expect(runs).toBe(1);
  });
});

describe("Map and Set entries that are objects", () => {
  test("has and get of an object key rerun after its set and delete", () => {
    const key = Object.create(null);
    const state = reactive({ map: new Map<object, number>() }, () => {});
    let seen: unknown[] = [];
    watchEffect(() => {
      seen = [state.map.has(key), state.map.get(key)];
    });
    state.map.set(key, 1);
    expect(seen).toEqual([true, 1]);
    state.map.delete(key);
    expect(seen).toEqual([false, undefined]);
  });

  test("has of an object value reruns after its add, delete and clear", () => {
    const member = { id: 1 };
    const state = reactive({ set: new Set<object>() }, () => {});
    let seen = false;
    watchEffect(() => {
      seen = state.set.has(member);
    });
    state.set.add(member);
    expect(seen).toBe(true);
    state.set.delete(member);
    expect(seen).toBe(false);
    state.set.add(member);
    state.set.clear();
    expect(seen).toBe(false);
  });
});

describe("a Map set of a new key to undefined", () => {
  // until 3.0.1 the write was taken for a no-op: no key, no event
  test("adds the key and reaches the replica", () => {
    const sync = replicate({ map: new Map<string, number | undefined>([["a", 1]]) });
    sync.state.map.set("z", undefined);
    expect(toRaw(sync.state.map).has("z")).toBe(true);
    expect(sync.inSync()).toBe(true);
  });

  test("a set of a held key to the undefined it holds sends nothing", () => {
    const sync = replicate({ map: new Map<string, number | undefined>([["a", undefined]]) });
    sync.clear();
    sync.state.map.set("a", undefined);
    expect(sync.paths()).toEqual([]);
  });
});

describe("a Map or Set proxy answers like the collection", () => {
  // until 3.0.1 the method cache found these on Object.prototype
  test("constructor and valueOf", () => {
    const state = reactive({ map: new Map(), set: new Set() }, () => {});
    expect(state.map.constructor).toBe(Map);
    expect(state.set.constructor).toBe(Set);
    expect(state.map.valueOf()).toBe(state.map);
    expect(state.set.valueOf()).toBe(state.set);
    expect([String(state.map), String(state.set)]).toEqual(["[object Map]", "[object Set]"]);
  });
});
