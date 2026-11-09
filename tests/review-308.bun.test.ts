import { describe, expect, test } from "bun:test";
import type * as Library from "../src/index";
import type { StateEvent } from "../src/types";

const { reactive, watchEffect, toRaw, updateState } = await import(
  process.env.RPS_TEST_BUNDLE ?? "../src/index"
) as typeof Library;

describe("a refusal blocks every later listener write in the operation", () => {
  for (const tracked of [false, true]) {
    test(`active parents cannot write after catching a nested refusal (effect=${tracked})`, () => {
      const errors: unknown[] = [];
      const events: StateEvent[] = [];
      let remote = { n: 0, m: 0 };
      let armed = false;
      const state = reactive({ n: 0, m: 0 }, event => {
        if (event.path.length === 0) { remote = event.newValue; return; }
        events.push(event);
        updateState(remote, event);
        if (!armed || event.path[0] !== "n") return;
        try { state.n++; } catch (error) { errors.push(error); }
        try { state.m++; } catch (error) { errors.push(error); }
      });
      armed = true;
      const write = () => { state.n = 1; };
      expect(() => tracked ? watchEffect(write) : write()).toThrow("nested 101 deep");
      expect(toRaw(state)).toEqual({ n: 101, m: 0 });
      expect(remote).toEqual(toRaw(state));
      expect(events).toHaveLength(101);
      expect(errors).toHaveLength(102);
      expect(errors.every(error => error === errors[0])).toBe(true);
      armed = false;
      state.m = 1;
      expect(remote).toEqual({ n: 101, m: 1 });
    });
  }
});

describe("Map membership, keys and values have separate dependencies", () => {
  for (const key of ["a", 1, NaN, undefined, Symbol("key"), { id: 1 }]) {
    test(`a value update leaves membership and ordered keys idle (${String(key)})`, () => {
      const map = reactive(new Map<unknown, number | undefined>([[key, 1]]));
      // Cached methods and iterators made outside the effect must still track reads.
      const has = map.has;
      const keys = map.keys;
      const runs = { has: 0, keys: 0, get: 0, values: 0, entries: 0, all: 0 };
      let membership = false;
      let orderedKeys: unknown[] = [];
      const stops = [
        watchEffect(() => { runs.has++; membership = has(key); }),
        watchEffect(() => { runs.keys++; orderedKeys = [...keys()]; }),
        watchEffect(() => { runs.get++; map.get(key); }),
        watchEffect(() => { runs.values++; [...map.values()]; }),
        watchEffect(() => { runs.entries++; [...map.entries()]; }),
        watchEffect(() => { runs.all++; has(key); [...keys()]; map.get(key); [...map.values()]; }),
      ];
      map.set(key, 2);
      expect(runs).toEqual({ has: 1, keys: 1, get: 2, values: 2, entries: 2, all: 2 });
      expect(membership).toBe(true);
      expect(orderedKeys).toEqual([key]);
      map.delete(key);
      expect(runs).toEqual({ has: 2, keys: 2, get: 3, values: 3, entries: 3, all: 3 });
      expect(membership).toBe(false);
      expect(orderedKeys).toEqual([]);
      map.set(key, undefined);
      expect(runs).toEqual({ has: 3, keys: 3, get: 4, values: 4, entries: 4, all: 4 });
      map.set("last", 3);
      expect(orderedKeys).toEqual([key, "last"]);
      map.delete(key);
      map.set(key, 4);
      expect(orderedKeys).toEqual(["last", key]);
      map.clear();
      expect(membership).toBe(false);
      expect(orderedKeys).toEqual([]);
      const before = { ...runs };
      map.clear();
      expect(runs).toEqual(before);
      for (const stop of stops) stop();
      map.set(key, 5);
      expect(runs).toEqual(before);
    });
  }

  test("an iterator created before an effect tracks keys on next", () => {
    const map = reactive(new Map([["a", 1], ["b", 2]]));
    const iterator = map.keys();
    let runs = 0;
    const seen: unknown[] = [];
    const stop = watchEffect(() => { runs++; seen.push(iterator.next().value); });
    map.set("a", 3);
    expect(runs).toBe(1);
    map.set("c", 4);
    expect(runs).toBe(2);
    expect(seen).toEqual(["a", "b"]);
    stop();
  });

  test("an effect drops membership dependencies when its branch changes", () => {
    const state = reactive({ key: "a", map: new Map([["a", 1], ["b", 2]]) });
    let runs = 0;
    const stop = watchEffect(() => { runs++; state.map.has(state.key); });
    state.key = "b";
    state.map.delete("a");
    state.map.set("b", 3);
    expect(runs).toBe(2);
    state.map.delete("b");
    expect(runs).toBe(3);
    stop();
  });
});
