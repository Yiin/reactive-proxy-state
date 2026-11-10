import { describe, expect, test } from "bun:test";
import type { StateEvent } from "../src/types";
import type * as Library from "../src/index";

const { reactive, computed, watchEffect, toRaw, updateState } = await import(
  process.env.RPS_TEST_BUNDLE ?? "../src/index"
) as typeof Library;

const writes: Record<string, { read: (s: ReturnType<typeof make>) => unknown; write: (s: ReturnType<typeof make>) => void }> = {
  "object set": { read: s => s.obj.a, write: s => { s.obj.a = 4; } },
  "object add": { read: s => JSON.stringify(s.obj), write: s => { s.obj.b = 4; } },
  "object delete": { read: s => JSON.stringify(s.obj), write: s => { delete s.obj.a; } },
  "array index": { read: s => s.list[0], write: s => { s.list[0] = 4; } },
  "array grow": { read: s => s.list.length, write: s => { s.list.length = 5; } },
  "array shrink": { read: s => s.list.length, write: s => { s.list.length = 1; } },
  "array delete": { read: s => s.list[0], write: s => { delete s.list[0]; } },
  "array push": { read: s => s.list.join(), write: s => { s.list.push(4); } },
  "array pop": { read: s => s.list.join(), write: s => { s.list.pop(); } },
  "array shift": { read: s => s.list[1], write: s => { s.list.shift(); } },
  "array unshift": { read: s => s.list[1], write: s => { s.list.unshift(4); } },
  "array splice": { read: s => s.list[1], write: s => { s.list.splice(0, 1); } },
  "array sort": { read: s => s.list[0], write: s => { s.list.sort((a, b) => b - a); } },
  "array reverse": { read: s => s.list[0], write: s => { s.list.reverse(); } },
  "array fill": { read: s => s.list[0], write: s => { s.list.fill(4); } },
  "array copyWithin": { read: s => s.list[0], write: s => { s.list.copyWithin(0, 1); } },
  "map set": { read: s => s.map.get("a"), write: s => { s.map.set("a", 4); } },
  "map add": { read: s => s.map.size, write: s => { s.map.set("c", 4); } },
  "map delete": { read: s => s.map.get("a"), write: s => { s.map.delete("a"); } },
  "map clear": { read: s => s.map.size, write: s => { s.map.clear(); } },
  "set add": { read: s => s.set.size, write: s => { s.set.add(4); } },
  "set delete": { read: s => s.set.has(1), write: s => { s.set.delete(1); } },
  "set clear": { read: s => s.set.size, write: s => { s.set.clear(); } },
};
function make() {
  return { obj: { a: 1 } as Record<string, number>, list: [1, 2, 3], map: new Map([["a", 1], ["b", 2]]), set: new Set([1, 2]), tick: 0, total: "" };
}

describe("3.0.3 listener ordering review", () => {
  for (const [name, { read, write }] of Object.entries(writes)) {
    test(`${name}: listeners read fresh computed chains, and effects wait for the outer write`, () => {
      let armed = false;
      let nested = false;
      const observed: unknown[][] = [];
      const totals: string[] = [];
      const events: StateEvent[] = [];
      const raw = make();
      const remote = structuredClone(raw);
      const state = reactive(raw, event => {
        if (!armed) return;
        events.push(structuredClone(event));
        updateState(remote, event);
        if (!nested) {
          nested = true;
          observed.push([read(state), first.value, second.value]);
          state.tick++;
          totals.push(state.total);
        }
      });
      const first = computed(() => read(state));
      const second = computed(() => first.value);
      const stop = watchEffect(() => {
        state.tick;
        state.total = JSON.stringify([read(state), first.value, second.value]);
      });
      remote.total = state.total;
      const before = state.total;
      armed = true;
      write(state);
      const value = read(state);
      expect(observed).toEqual([[value, value, value]]);
      // 3.0.4 ran the effect when the listener's write ended. Effects now
      // wait for the outermost write, so a listener that writes before it
      // forwards an event cannot have an effect's event sent first
      expect(totals).toEqual([before]);
      expect(events.filter(event => event.path[0] === "total").map(event => event.newValue)).toEqual([JSON.stringify([value, value, value])]);
      expect(remote.total).toBe(state.total);
      stop(); first.stop(); second.stop();
    });
  }
  for (const method of ["shift", "splice", "unshift"] as const) {
    test(`${method}: a listener cannot hide a changed index`, () => {
      let armed = false;
      const raw = [0, 1, 2];
      const state = reactive({ list: raw }, event => {
        if (armed && event.action === `array-${method}`) state.list[method === "unshift" ? 2 : 0] = method === "unshift" ? 0 : 2;
      });
      const values: number[] = [];
      const stop = watchEffect(() => { values.push(state.list[1]); });
      armed = true;
      if (method === "splice") state.list.splice(0, 1);
      else if (method === "unshift") state.list.unshift(3);
      else state.list.shift();
      expect(values).toEqual([1, method === "unshift" ? 0 : 2]);
      stop();
    });
  }
  test("source effects run in source order when the outermost write ends", () => {
    const order: string[] = [];
    let armed = false;
    const state = reactive({ a: 0, b: 0 }, event => {
      if (!armed) return;
      order.push(`event:${event.path[0]}`);
      if (event.path[0] === "a") {
        state.b++;
        order.push("nested-return");
      }
    });
    const a = watchEffect(() => { state.a; if (armed) order.push("effect:a"); });
    const b = watchEffect(() => { state.b; if (armed) order.push("effect:b"); });
    armed = true;
    state.a++;
    // 3.0.4 ran both effects before the listener's write returned
    expect(order).toEqual(["event:a", "event:b", "nested-return", "effect:a", "effect:b"]);
    a(); b();
  });
  test("method replacement and deletion take effect inside listeners", () => {
    let armed = false;
    const seen: unknown[] = [];
    const state = reactive({ list: [1, 2] }, event => {
      if (armed && event.path[1] === "map") seen.push(state.list.map(x => x + 1));
    });
    state.list.map;
    armed = true;
    Object.assign(state.list, { map: () => 42 });
    Reflect.deleteProperty(state.list, "map");
    expect(seen).toEqual([42, [2, 3]]);
  });
});

for (const collection of ["array", "map", "set"] as const) {
  for (const method of ["keys", "values", "entries", Symbol.iterator] as const) {
    test(`saved ${collection} ${String(method)} tracks every next and stays consumed`, () => {
      const state = reactive({ list: [1, 2, 3], map: new Map([[1, 1], [2, 2], [3, 3]]), set: new Set([1, 2, 3]) });
      const iterator = (collection === "array" ? state.list : collection === "map" ? state.map : state.set)[method]();
      const steps: IteratorResult<unknown>[] = [];
      const stop = watchEffect(() => { steps.push(iterator.next()); });
      const change = (n: number) => {
        if (collection === "array") state.list[n - 1] = n * 10;
        else if (collection === "map") state.map.set(n, n * 10);
        else state.set.add(n * 10);
      };
      change(2); change(3);
      const mapKeys = collection === "map" && method === "keys";
      if (mapKeys) {
        expect(steps).toEqual([{ value: 1, done: false }]);
        state.map.set(4, 40);
        state.map.set(5, 50);
      }
      const values = collection === "set" || method === "keys" ? [1, 2, 3] : [1, 20, 30];
      if (collection === "array" && method === "keys") values.splice(0, 3, 0, 1, 2);
      const pairs = method === "entries" || (method === Symbol.iterator && collection === "map");
      expect(steps).toEqual(values.map((value, i) => ({ value: pairs ? [collection === "array" ? i : collection === "map" ? i + 1 : value, value] : value, done: false })));
      while (!iterator.next().done) { /* consume the live iterator */ }
      change(mapKeys ? 6 : 4);
      expect(steps.at(-1)).toEqual({ value: undefined, done: true });
      const count = steps.length;
      change(mapKeys ? 7 : 5);
      expect(steps.length).toBe(count);
      stop();
    });
  }
}

test("a missing undefined property is stored, sent, and tracked", () => {
  const events: StateEvent[] = [];
  const state = reactive({ obj: {} as Record<string, unknown> }, event => { events.push(event); });
  events.length = 0;
  const observed: unknown[] = [];
  const stop = watchEffect(() => { state.obj.newKey; observed.push(Object.keys(state.obj)); });
  state.obj.newKey = undefined;
  state.obj.newKey = undefined;
  expect(Object.hasOwn(toRaw(state.obj), "newKey")).toBe(true);
  expect(events).toEqual([{ action: "set", path: ["obj", "newKey"], oldValue: undefined, newValue: undefined }]);
  expect(observed).toEqual([[], ["newKey"]]);
  stop();
});

for (const method of ["getOrInsert", "getOrInsertComputed"] as const) {
  test(`${method} sends inserts, tracks reads, wraps results, and leaves existing values alone`, () => {
    const events: StateEvent[] = [];
    const state = reactive({ map: new Map<string, { n: number } | undefined>() }, event => { events.push(event); });
    events.length = 0;
    const calls: string[] = [];
    const insert = (key: string, value: { n: number } | undefined) => {
      const fn = Reflect.get(state.map, method);
      return Reflect.apply(fn, state.map, [key, method === "getOrInsertComputed" ? (key: string) => { calls.push(key); return value; } : value]);
    };
    const seen: unknown[] = [];
    const stop = watchEffect(() => { seen.push(state.map.get("a")); });
    expect(insert("a", undefined)).toBeUndefined();
    expect(insert("a", { n: 9 })).toBeUndefined();
    const object = insert("b", { n: 1 });
    object.n = 2;
    expect(events.map(event => event.action)).toEqual(["map-set", "map-set", "set"]);
    expect(seen).toEqual([undefined, undefined]);
    expect(state.map.get("b")?.n).toBe(2);
    if (method === "getOrInsertComputed") expect(calls).toEqual(["a", "b"]);
    stop();
  });
}

test("getOrInsertComputed keeps native callback and return rules during nested writes", () => {
  let armed = false;
  const state = reactive({ map: new Map<number, number>() }, event => {
    if (armed && event.action === "map-set") state.map.delete(0);
  });
  const insert = Reflect.get(state.map, "getOrInsertComputed");
  const keys: number[] = [];
  armed = true;
  expect(Reflect.apply(insert, state.map, [-0, (key: number) => { keys.push(key); return 7; }])).toBe(7);
  expect(Object.is(keys[0], 0)).toBe(true);
  expect(state.map.has(0)).toBe(false);
  armed = false;
  state.map.set(1, 1);
  expect(() => Reflect.apply(insert, state.map, [1, 4])).toThrow(TypeError);
  expect(() => Reflect.apply(insert, state.map, [2, () => { throw Error("callback failed"); }])).toThrow("callback failed");
  expect(state.map.has(2)).toBe(false);
  expect(Reflect.apply(insert, state.map, [2, () => { state.map.set(2, 5); return 9; }])).toBe(9);
  expect(state.map.get(2)).toBe(9);
});

for (const method of ["shift", "splice", "unshift"] as const) {
  test(`${method}: a listener preserves changed hole dependencies`, () => {
    let armed = false;
    const initial = method === "unshift" ? [undefined, , undefined] : [undefined, undefined, , undefined];
    const state = reactive({ list: initial }, event => {
      if (armed && event.action === `array-${method}`) {
        if (method === "unshift") state.list[2] = undefined;
        else delete state.list[0];
      }
    });
    const holes: boolean[] = [];
    const stop = watchEffect(() => { state.list[1]; holes.push(1 in toRaw(state.list)); });
    armed = true;
    if (method === "unshift") state.list.unshift(undefined);
    else if (method === "splice") state.list.splice(0, 1);
    else state.list.shift();
    expect(holes).toEqual(method === "unshift" ? [false, true] : [true, false]);
    stop();
  });
}

for (const method of ["map", "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin", "find", "findLast", "at", "indexOf", "includes", "values", "entries", "keys", Symbol.iterator]) {
  test(`a listener sees the replacement of cached ${String(method)}`, () => {
    let armed = false;
    const seen: unknown[] = [];
    const state = reactive({ list: [1, 2] }, event => {
      if (armed && event.action === "set") seen.push(Reflect.apply(Reflect.get(state.list, method), state.list, []));
    });
    Reflect.get(state.list, method);
    armed = true;
    Reflect.set(state.list, method, () => 42);
    // a symbol key sends nothing (3.0.19): the next read sees the replacement
    if (typeof method === "symbol") expect(Reflect.apply(Reflect.get(state.list, method), state.list, [])).toBe(42);
    expect(seen).toEqual(typeof method === "symbol" ? [] : [42]);
    Reflect.deleteProperty(state.list, method);
    expect(Reflect.get(state.list, method)).toBeFunction();
  });
}

for (const kind of ["map", "set"] as const) {
  test(`saved ${kind} iterator restores tracking after explicit cleanup inside a run`, async () => {
    const { cleanupEffect } = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index") as typeof Library;
    const value = kind === "map" ? reactive(new Map([[1, 1], [2, 2], [3, 3], [4, 4]])) : reactive(new Set([1, 2, 3, 4]));
    const iterator = value.values();
    let runs = 0;
    const stop = watchEffect(() => {
      runs++;
      iterator.next();
      cleanupEffect(stop.effect);
      iterator.next();
    }, { lazy: true });
    stop.effect.run();
    expect(stop.effect.dependencies?.size).toBe(1);
    if (value instanceof Map) value.set(3, 30);
    else value.add(5);
    expect(runs).toBe(2);
    expect(stop.effect.dependencies?.size).toBe(1);
    stop();
  });
}

test("trigger hooks see fresh computed values and cannot drop source events when they throw", () => {
  const events: StateEvent[] = [];
  const state = reactive({ n: 1 }, event => { events.push(event); });
  const seen: number[] = [];
  const hookValues: number[] = [];
  const derived = computed(() => state.n * 2);
  const stop = watchEffect(() => { seen.push(state.n); }, {
    onTrigger: () => { hookValues.push(derived.value); throw Error("hook failed"); },
  });
  expect(derived.value).toBe(2);
  events.length = 0;
  expect(() => { state.n = 2; }).toThrow("hook failed");
  expect(events).toEqual([{ action: "set", path: ["n"], oldValue: 1, newValue: 2 }]);
  expect(hookValues).toEqual([4]);
  expect(seen).toEqual([1, 2]);
  stop(); derived.stop();
});
