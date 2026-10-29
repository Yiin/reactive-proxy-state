import { describe, expect, test } from "bun:test";
import { reactive, toRaw } from "../src/index";
import type { StateEvent } from "../src/types";
import { replicate } from "./replica";

/**
 * One object at many places (a list of rows that all point to one shared
 * config, or `Array(n).fill(leaf)`). A store gives each place to the object
 * once, so its work grows with the places it adds, not with their square.
 *
 * Work is counted as `WeakRef.prototype.deref` calls: every step of the
 * place walks reads a place's container through one. The counts do not
 * depend on the machine; the timed checks below them have a wide margin.
 */

const ROWS = 4_000;
// a linear store derefs a few times per place; the quadratic one derefs millions of times
const DEREFS_PER_PLACE = 40;

function countDerefs(run: () => void): number {
  const original = WeakRef.prototype.deref;
  let derefs = 0;
  WeakRef.prototype.deref = function (this: WeakRef<object>) {
    derefs++;
    return original.call(this);
  };
  try {
    run();
  } finally {
    WeakRef.prototype.deref = original;
  }
  return derefs;
}

function rows(count: number, shared: object): { i: number; ref: object }[] {
  return Array.from({ length: count }, (_, i) => ({ i, ref: shared }));
}

const noop = (_event: StateEvent) => {};

describe("a store of one object at many places", () => {
  test("root creation with rows that share one object", () => {
    const shared = { v: 0 };
    const value = { list: rows(ROWS, shared) };
    const derefs = countDerefs(() => reactive(value, noop));
    expect(derefs).toBeLessThan(DEREFS_PER_PLACE * ROWS);
  });

  test("root creation of Array(n).fill(leaf)", () => {
    const value = Array(ROWS).fill({ v: 0 });
    const derefs = countDerefs(() => reactive(value, noop));
    expect(derefs).toBeLessThan(DEREFS_PER_PLACE * ROWS);
  });

  test("assignment of rows that share an object the state does not hold", () => {
    const state = reactive({ list: [] as any[] }, noop);
    const value = rows(ROWS, { v: 0 });
    const derefs = countDerefs(() => {
      state.list = value;
    });
    expect(derefs).toBeLessThan(DEREFS_PER_PLACE * ROWS);
  });

  test("assignment of rows that share an object the state holds", () => {
    const state = reactive({ config: { v: 0 }, list: [] as any[] }, noop);
    const value = rows(ROWS, toRaw(state).config);
    const derefs = countDerefs(() => {
      state.list = value;
    });
    expect(derefs).toBeLessThan(DEREFS_PER_PLACE * ROWS);
  });

  test("assignment of Array(n).fill(object)", () => {
    const state = reactive({ config: { v: 0 }, list: [] as any[], other: [] as any[] }, noop);
    const derefs = countDerefs(() => {
      state.list = Array(ROWS).fill({ v: 1 });
      state.other = Array(ROWS).fill(toRaw(state).config);
    });
    expect(derefs).toBeLessThan(2 * DEREFS_PER_PLACE * ROWS);
  });

  test("a full read after root creation, with and without a listener", () => {
    for (const emit of [noop, undefined]) {
      const shared = { v: 0 };
      const state = reactive({ list: rows(ROWS, shared) }, emit);
      const derefs = countDerefs(() => {
        for (let i = 0; i < ROWS; i++) void state.list[i].ref.v;
      });
      expect(derefs).toBeLessThan(DEREFS_PER_PLACE * ROWS);
    }
  });

  test("rows read and then removed one at a time, from either end", () => {
    for (const remove of ["shift", "pop"] as const) {
      const state = reactive({ list: rows(ROWS, { v: 0 }) }, noop);
      for (let i = 0; i < ROWS; i++) void state.list[i].ref.v;
      const derefs = countDerefs(() => {
        for (let i = 0; i < ROWS; i++) state.list[remove]();
      });
      expect(derefs).toBeLessThan(DEREFS_PER_PLACE * ROWS);
    }
  });

  test("a write through the shared object still reaches every place", () => {
    const shared = { v: 0 };
    const sync = replicate({ list: rows(50, shared), fill: Array(30).fill(shared) });
    sync.clear();
    sync.state.list[7].ref.v = 3;
    expect(sync.events.length).toBe(80);
    expect(sync.inSync()).toBe(true);
    sync.clear();
    sync.state.fill[3].v = 4;
    expect(sync.events.length).toBe(80);
    expect(sync.inSync()).toBe(true);
  });

  test("a removed row that comes back gets its place again", () => {
    const shared = { v: 0 };
    const sync = replicate({ list: rows(20, shared) });
    for (let i = 0; i < 20; i++) void sync.state.list[i].ref.v;
    const last = sync.state.list.pop();
    const first = sync.state.list.shift();
    sync.state.list[3].ref.v = 1;
    expect(sync.inSync()).toBe(true);
    sync.state.list.push(last);
    sync.state.list.unshift(first);
    sync.clear();
    sync.state.list[5].ref.v = 2;
    expect(sync.events.length).toBe(20);
    expect(sync.inSync()).toBe(true);
  });
});

describe("32,000 rows that share one object", () => {
  const COUNT = 32_000;
  // about 60 ms on a desktop; the quadratic walks took minutes
  const BOUND_MS = 2_000;

  function timed(run: () => void): number {
    const start = performance.now();
    run();
    return performance.now() - start;
  }

  test("root creation and a full read", () => {
    const value = { list: rows(COUNT, { v: 0 }) };
    const ms = timed(() => {
      const state = reactive(value, noop);
      for (let i = 0; i < COUNT; i++) void state.list[i].ref.v;
    });
    expect(ms).toBeLessThan(BOUND_MS);
  });

  test("assignment, then Array(n).fill(object)", () => {
    const state = reactive({ list: [] as any[] }, noop);
    const value = rows(COUNT, { v: 0 });
    const filled = Array(COUNT).fill({ v: 0 });
    const ms = timed(() => {
      state.list = value;
      state.list = filled;
    });
    expect(ms).toBeLessThan(BOUND_MS);
  });
});
