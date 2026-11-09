import { describe, expect, test } from "bun:test";
import { computed, reactive, toRaw, watchEffect } from "../src/index";
import { dependencyCounts } from "../src/watch-effect";

/**
 * Entries of Maps and Sets have dependencies of their own, apart from
 * properties and keyed by the entry itself. Until 3.0.2 an entry shared a
 * string key with properties and with other entries: `m.set("get", 1)`
 * reran an effect that read only `m.get("a")` (the method name "get"), and
 * the entries 1 and "1" were one.
 *
 * A dependency set goes when its last effect leaves, and an empty map of
 * them goes with the next write to its target. Until 3.0.2 an effect that
 * read 10,000 changing keys and stopped left 10,000 empty sets behind.
 */

describe("an entry has its own dependency", () => {
  const mapCollisions: [string, unknown, unknown][] = [
    ["the method name get", "a", "get"],
    ["the method name has", "a", "has"],
    ["the property size", "a", "size"],
    ["the method name set", "a", "set"],
    ["1 and '1'", 1, "1"],
    ["true and 'true'", true, "true"],
    ["null and 'null'", null, "null"],
    ["undefined and 'undefined'", undefined, "undefined"],
    ["two objects", { id: 1 }, { id: 2 }],
    ["an object and '[object Object]'", { id: 1 }, "[object Object]"],
    ["a function and its source", function key() {}, "function key() {}"],
    ["a symbol and its name", Symbol("s"), "Symbol(s)"],
    ["0 and '0'", 0, "0"],
  ];
  for (const [name, read, written] of mapCollisions) {
    test(`Map get and has of one key do not rerun after a set of another: ${name}`, () => {
      const state = reactive({ map: new Map<unknown, number>([[read, 1]]) }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.map.get(read);
        state.map.has(read);
      });
      state.map.set(written, 2);
      state.map.delete(written);
      expect(runs).toBe(1);
      state.map.set(read, 5);
      expect(runs).toBe(2);
    });

    test(`Set has of one value does not rerun after an add of another: ${name}`, () => {
      const state = reactive({ set: new Set<unknown>([read]) }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.set.has(read);
      });
      state.set.add(written);
      state.set.delete(written);
      expect(runs).toBe(1);
      state.set.delete(read);
      expect(runs).toBe(2);
    });
  }

  test("NaN is one entry, and -0 is 0, as the collection keys them", () => {
    const state = reactive({ map: new Map<number, string>(), set: new Set<number>() }, () => {});
    const seen: unknown[] = [];
    watchEffect(() => {
      seen.push([state.map.get(NaN), state.set.has(0)]);
    });
    state.map.set(NaN, "nan");
    state.set.add(-0);
    expect(seen).toEqual([[undefined, false], ["nan", false], ["nan", true]]);
  });

  test("a property read of a Map does not rerun after an entry write", () => {
    const state = reactive({ map: new Map<string, number>() }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.map.get;
      state.map.set;
      (state.map as any).constructor;
    });
    state.map.set("get", 1);
    state.map.set("constructor", 1);
    expect(runs).toBe(1);
  });

  test("an index read of a Set iteration does not rerun after an add of that number", () => {
    const state = reactive({ set: new Set<number>([5]), other: new Set<number>([7]) }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      [...state.set];
    });
    state.other.add(0);
    expect(runs).toBe(1);
    state.set.add(0);
    expect(runs).toBe(2);
  });
});

describe("dependency sets go when their last effect leaves", () => {
  test("an effect that read 10,000 keys of a Map leaves nothing when it stops", () => {
    const state = reactive({ map: new Map<string, number>() }, () => {});
    const raw = toRaw(state.map);
    const stop = watchEffect(() => {
      for (let i = 0; i < 10_000; i++) state.map.has(`k${i}`);
      state.map.size;
    });
    expect(dependencyCounts(raw)).toEqual({ properties: 1, entries: 10_000 });
    stop();
    expect(dependencyCounts(raw)).toEqual({ properties: 0, entries: 0 });
    // the empty maps go with the next write
    state.map.set("k0", 1);
    expect(dependencyCounts(raw)).toEqual({ properties: undefined, entries: undefined });
  });

  test("an effect that reads changing keys keeps only the ones it read last", () => {
    const state = reactive({ map: new Map<string, number>(), round: 0 }, () => {});
    const raw = toRaw(state.map);
    watchEffect(() => {
      const round = state.round;
      for (let i = 0; i < 100; i++) state.map.has(`r${round}-${i}`);
    });
    for (let round = 1; round <= 50; round++) state.round = round;
    expect(dependencyCounts(raw)).toEqual({ properties: undefined, entries: 100 });
  });

  test("a rerun keeps the dependency sets it reads again", () => {
    const state = reactive({ obj: { a: 1, b: 2 }, n: 0 }, () => {});
    const raw = toRaw(state.obj);
    watchEffect(() => {
      state.n;
      state.obj.a;
      state.obj.b;
    });
    state.n = 1;
    state.n = 2;
    expect(dependencyCounts(raw)).toEqual({ properties: 2, entries: undefined });
  });

  test("an array, a Set and an object leave nothing when their effects stop", () => {
    const state = reactive({ list: [1, 2, 3], set: new Set([1]), obj: { a: 1 } }, () => {});
    const stops = [
      watchEffect(() => {
        state.list[0];
        state.list.length;
        state.list.map((value) => value);
      }),
      watchEffect(() => {
        state.set.has(1);
        [...state.set];
        state.set.size;
      }),
      watchEffect(() => {
        JSON.stringify(state.obj);
      }),
      computed(() => state.obj.a).stop,
    ];
    for (const stop of stops) stop();
    for (const raw of [toRaw(state.list), toRaw(state.set), toRaw(state.obj)]) {
      const counts = dependencyCounts(raw);
      expect((counts.properties ?? 0) + (counts.entries ?? 0)).toBe(0);
    }
    // the root still has the effects' reads of `list`, `set` and `obj`: none, they stopped
    expect(dependencyCounts(toRaw(state)).properties ?? 0).toBe(0);
  });

  test("an effect that stops while another reruns keeps the other's dependencies", () => {
    const state = reactive({ a: 0, b: 0 }, () => {});
    const raw = toRaw(state);
    let stopOther = () => {};
    watchEffect(() => {
      state.a;
      if (state.b === 1) stopOther();
    });
    stopOther = watchEffect(() => {
      state.a;
    });
    state.b = 1;
    expect(dependencyCounts(raw).properties).toBe(2);
    let runs = 0;
    watchEffect(() => (state.a, runs++));
    state.a = 1;
    expect(runs).toBe(2);
  });
});
