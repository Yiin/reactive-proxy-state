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

for (const readers of [["has", "get"], ["get", "has"], ["keys", "values"], ["values", "keys"]] as const) {
  test(`Map readers keep their subscription order: ${readers.join(", ")}`, () => {
    const map = reactive(new Map<string, number>());
    const order: string[] = [];
    const stops = readers.map(reader => watchEffect(() => {
      if (reader === "has") map.has("a");
      else if (reader === "get") map.get("a");
      else if (reader === "keys") [...map.keys()];
      else [...map.values()];
      order.push(reader);
    }));
    for (const write of [() => map.set("a", 1), () => map.delete("a"), () => map.set("a", 2), () => map.clear()]) {
      order.length = 0;
      write();
      expect(order).toEqual([...readers]);
    }
    stops.forEach(stop => stop());
  });
}

for (const iteration of [false, true]) {
  test(`an effect can switch between membership and value reads (iteration=${iteration})`, () => {
    const state = reactive({ values: true, map: new Map([["a", 1]]) });
    let runs = 0;
    const stop = watchEffect(() => {
      runs++;
      if (state.values) {
        if (iteration) [...state.map.values()];
        else state.map.get("a");
      }
      if (iteration) [...state.map.keys()];
      else state.map.has("a");
    });
    state.map.set("a", 2);
    expect(runs).toBe(2);
    state.values = false;
    state.map.set("a", 3);
    expect(runs).toBe(3);
    state.values = true;
    state.map.set("a", 4);
    expect(runs).toBe(5);
    stop();
  });
}

for (const readers of [["has", "get"], ["get", "has"], ["keys", "values"], ["values", "keys"]] as const) {
  test(`nested Map writes queue readers in trigger order: ${readers.join(", ")}`, () => {
    const events: StateEvent[] = [];
    const order: string[] = [];
    let remote = { go: 0, map: new Map([["a", 1]]), stamp: "" };
    let stamp = "";
    const state = reactive({ go: 0, map: new Map([["a", 1]]), stamp: "" }, event => {
      if (event.path.length === 0) { remote = event.newValue; return; }
      events.push(event);
      updateState(remote, event);
      if (event.path[0] === "go") {
        state.map.set("a", 2);
        state.map.delete("a");
      }
    });
    const stops = readers.map(reader => watchEffect(() => {
      if (reader === "has") state.map.has("a");
      else if (reader === "keys") [...state.map.keys()];
      else if (reader === "get") state.map.get("a");
      else [...state.map.values()];
      order.push(reader);
      stamp += reader + ";";
      state.stamp = stamp;
    }));
    order.length = 0;
    events.length = 0;
    stamp = "";
    state.go = 1;
    const valueReader = readers.some(reader => reader === "get") ? "get" : "values";
    const membershipReader = readers.some(reader => reader === "has") ? "has" : "keys";
    expect(order).toEqual([valueReader, membershipReader]);
    expect(events.filter(event => event.path[0] === "stamp").map(event => event.newValue)).toEqual([
      valueReader + ";", valueReader + ";" + membershipReader + ";",
    ]);
    expect(remote).toEqual(toRaw(state));
    stops.forEach(stop => stop());
  });
}

for (const tracked of [false, true]) {
  test(`a parent loses its later write when a child swallows every refusal (effect=${tracked})`, () => {
    const childErrors: unknown[] = [];
    const parentErrors: unknown[] = [];
    const paths: unknown[] = [];
    let remote = { x: 0, a: 0, loop: 0, b: 0 };
    let armed = true;
    const state = reactive({ ...remote }, event => {
      if (event.path.length === 0) { remote = event.newValue; return; }
      paths.push(event.path[0]);
      updateState(remote, event);
      if (!armed) return;
      if (event.path[0] === "x") {
        state.a = 1;
        expect(parentErrors).toHaveLength(0);
        try { state.b = 1; } catch (error) { parentErrors.push(error); }
      } else if (event.path[0] === "a" || event.path[0] === "loop") {
        try { state.loop++; } catch (error) { childErrors.push(error); }
      }
    });
    const write = () => { state.x = 1; };
    expect(() => tracked ? watchEffect(write) : write()).toThrow("nested 101 deep");
    expect(toRaw(state)).toEqual({ x: 1, a: 1, loop: 99, b: 0 });
    expect(remote).toEqual(toRaw(state));
    expect(parentErrors).toHaveLength(1);
    expect(childErrors).toHaveLength(1);
    expect(parentErrors[0]).toBe(childErrors[0]);
    expect(paths).not.toContain("b");
    armed = false;
    state.b = 1;
    expect(remote).toEqual({ x: 1, a: 1, loop: 99, b: 1 });
  });
}

for (const reader of ["has", "keys"] as const) {
  test(`Map ${reader} onTrigger hooks ignore value updates and report key changes`, () => {
    const map = reactive(new Map([["a", 1]]));
    let runs = 0;
    const triggers: unknown[] = [];
    const stop = watchEffect(() => {
      runs++;
      if (reader === "has") map.has("a");
      else [...map.keys()];
    }, { onTrigger: event => { triggers.push(event.key); } });
    map.set("a", 2);
    expect(runs).toBe(1);
    expect(triggers).toEqual([]);
    map.delete("a");
    expect(runs).toBe(2);
    expect(triggers).toHaveLength(1);
    map.set("a", 3);
    expect(runs).toBe(3);
    expect(triggers).toHaveLength(2);
    map.set("a", 4);
    expect(runs).toBe(3);
    expect(triggers).toHaveLength(2);
    map.clear();
    expect(runs).toBe(4);
    expect(triggers).toHaveLength(3);
    map.clear();
    stop();
    map.set("a", 5);
    expect(triggers).toHaveLength(3);
  });
}
