import { describe, expect, test } from "bun:test";
import { UnsupportedStateError, reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";

/**
 * The input contract (README, "Supported inputs"): for supported input the
 * replica always equals the state; unsupported input either stays correct
 * or is refused before anything changes, never a silent mismatch.
 */

async function fixture<T extends object>(raw: T, async: boolean) {
  let remote: any;
  const events: StateEvent[] = [];
  const state = reactive(
    raw,
    (event) => {
      events.push(event);
      if (remote === undefined) remote = structuredClone(event.newValue);
      else updateState(remote, structuredClone(event));
    },
    [],
    { async }
  );
  await Promise.resolve();
  events.length = 0;
  return { state, events, remote: () => remote };
}

describe("sort: the comparator's own writes", () => {
  for (const async of [false, true]) {
    test(`a tail the comparator appends stays, as native sort keeps it, async=${async}`, async () => {
      const raw = { list: [3, 1, 2] };
      const f = await fixture(raw, async);
      let first = true;
      f.state.list.sort((a, b) => {
        if (first) {
          first = false;
          f.state.list.push(4);
        }
        return a - b;
      });
      await Promise.resolve();
      expect(raw.list).toEqual([1, 2, 3, 4]);
      expect(f.remote()).toEqual(raw);
    });

    test(`an item the comparator writes in place is sorted over, also when the order holds, async=${async}`, async () => {
      const raw = { list: [1, 2, 3] };
      const f = await fixture(raw, async);
      let first = true;
      f.state.list.sort((a, b) => {
        if (first) {
          first = false;
          f.state.list[0] = 99;
        }
        return a - b;
      });
      await Promise.resolve();
      // native sort writes back the items it read before comparing
      expect(raw.list).toEqual([1, 2, 3]);
      expect(f.remote()).toEqual(raw);
    });

    test(`items the comparator removes or puts in front come back the native way, async=${async}`, async () => {
      for (const write of ["pop", "unshift"] as const) {
        const raw = { list: [3, 1, 2] };
        const f = await fixture(raw, async);
        const native = [3, 1, 2];
        let first = true;
        native.sort((a, b) => {
          if (first) {
            first = false;
            if (write === "pop") native.pop();
            else native.unshift(0);
          }
          return a - b;
        });
        first = true;
        f.state.list.sort((a, b) => {
          if (first) {
            first = false;
            if (write === "pop") f.state.list.pop();
            else f.state.list.unshift(0);
          }
          return a - b;
        });
        await Promise.resolve();
        expect(raw.list).toEqual(native);
        expect(f.remote()).toEqual(raw);
      }
    });
  }
});

describe("fill and copyWithin bounds", () => {
  for (const async of [false, true]) {
    for (const method of ["fill", "copyWithin"] as const) {
      test(`${method} converts a bound once, async=${async}`, async () => {
        const raw = { list: [0, 1, 2, 3] };
        const f = await fixture(raw, async);
        let calls = 0;
        const bound: any = { valueOf: () => (calls++ === 0 ? 1 : 2) };
        if (method === "fill") f.state.list.fill(9, bound, 3);
        else f.state.list.copyWithin(0, bound, 3);
        await Promise.resolve();
        expect(calls).toBe(1);
        expect(raw.list).toEqual(method === "fill" ? [0, 9, 9, 3] : [1, 2, 2, 3]);
        expect(f.remote()).toEqual(raw);
      });

      test(`${method} with a bound that writes through the proxy keeps the replica, async=${async}`, async () => {
        const raw = { list: [0, 1, 2, 3] };
        const f = await fixture(raw, async);
        const bound: any = {
          valueOf() {
            f.state.list.push(7);
            return 1;
          },
        };
        if (method === "fill") f.state.list.fill(9, bound);
        else f.state.list.copyWithin(0, bound);
        await Promise.resolve();
        expect(f.remote()).toEqual(raw);
      });
    }
  }

  for (const method of ["fill", "copyWithin", "splice"] as const) {
    test(`${method} accepts numeric-string bounds`, async () => {
      const raw = { list: [0, 1, 2, 3] };
      const f = await fixture(raw, false);
      const bound: any = "1";
      if (method === "fill") f.state.list.fill(9, bound, "3" as any);
      else if (method === "copyWithin") f.state.list.copyWithin(0, bound, "3" as any);
      else f.state.list.splice(bound, 1);
      expect(raw.list).toEqual(method === "fill" ? [0, 9, 9, 3] : method === "copyWithin" ? [1, 2, 2, 3] : [0, 2, 3]);
      expect(f.remote()).toEqual(raw);
    });
  }

  test("a BigInt or Symbol bound throws a TypeError before any change, like native", async () => {
    const raw = { list: [0, 1, 2, 3] };
    const f = await fixture(raw, false);
    expect(() => f.state.list.fill(9, 1n as any)).toThrow(TypeError);
    expect(() => f.state.list.copyWithin(0, Symbol("x") as any)).toThrow(TypeError);
    expect(raw.list).toEqual([0, 1, 2, 3]);
    expect(f.events).toHaveLength(0);
  });
});

describe("getters on the back-reference path", () => {
  for (const async of [false, true]) {
    test(`a container getter is refused before the write, without calling it, async=${async}`, async () => {
      let calls = 0;
      const raw: any = {
        x: null,
        get present() {
          calls++;
          return this.x !== null;
        },
      };
      const f = await fixture(raw, async);
      calls = 0;
      expect(() => {
        f.state.x = { back: raw };
      }).toThrow(UnsupportedStateError);
      await Promise.resolve();
      expect(calls).toBe(0);
      expect(raw.x).toBeNull();
      expect(f.events).toHaveLength(0);
      // a write that does not reach back is not refused
      f.state.x = { n: 1 };
      await Promise.resolve();
      expect(f.remote().x).toEqual({ n: 1 });
    });

    test(`a getter in a payload that reaches back is refused before the write, async=${async}`, async () => {
      const raw: any = { x: null };
      const f = await fixture(raw, async);
      // the set trap reads the new value's own properties (to unwrap stored
      // proxies), so this getter runs once; the copy refuses it before the write
      expect(() => {
        f.state.x = {
          back: raw,
          get present() {
            return this.back.x !== null;
          },
        };
      }).toThrow(UnsupportedStateError);
      await Promise.resolve();
      expect(raw.x).toBeNull();
      expect(f.events).toHaveLength(0);
      expect(f.remote()).toEqual({ x: null });
    });
  }

  test("map and set writes that reach back refuse a getter in the payload", async () => {
    const raw: any = { map: new Map(), set: new Set() };
    const f = await fixture(raw, false);
    const withGetter = (back: object) => ({
      back,
      get n() {
        return 1;
      },
    });
    expect(() => f.state.map.set("a", withGetter(raw.map))).toThrow(UnsupportedStateError);
    expect(() => f.state.set.add(withGetter(raw.set))).toThrow(UnsupportedStateError);
    expect(raw.map.size + raw.set.size).toBe(0);
    expect(f.events).toHaveLength(0);
  });

  test("a back-reference payload of data properties is copied as it will be after the write", async () => {
    const raw: any = { x: null, n: 1 };
    const f = await fixture(raw, false);
    f.state.x = { back: raw };
    const event = f.events[0];
    expect(event.newValue.back.x).toBe(event.newValue);
    expect(event.newValue.back.n).toBe(1);
  });
});

describe("read-only and frozen arrays in reorders", () => {
  test("sort accepts a frozen one-item array, like native sort", () => {
    const raw = Object.freeze([1]);
    const events: unknown[] = [];
    const state: any = reactive(raw, (event) => events.push(event));
    events.length = 0;
    expect(() => state.sort()).not.toThrow();
    expect(() => state.sort((a: number, b: number) => a - b)).not.toThrow();
    expect(() => state.reverse()).not.toThrow();
    expect(raw).toEqual([1]);
    expect(events).toHaveLength(0);
  });

  const cases = [
    // a read-only index the reorder would write refuses it before any write
    { method: "sort", list: [2, 3, 1], args: [] },
    { method: "reverse", list: [3, 2, 1, 0], args: [] },
    { method: "fill", list: [3, 2, 1], args: [0] },
    { method: "copyWithin", list: [3, 2, 1], args: [0, 1] },
  ] as const;
  for (const { method, list, args } of cases) {
    test(`${method} refuses a later read-only index before its earlier writes`, async () => {
      const raw = { list: list.slice() };
      const f = await fixture(raw, false);
      Object.defineProperty(raw.list, "1", { writable: false });
      expect(() => (f.state.list as any)[method](...args)).toThrow(TypeError);
      expect(raw.list).toEqual(list.slice());
      expect(f.remote()).toEqual(raw);
      expect(f.events).toHaveLength(0);
    });
  }

  test("a read-only index outside the range native writes does not refuse", async () => {
    const raw = { list: [3, 2, 1, 0] };
    const f = await fixture(raw, false);
    Object.defineProperty(raw.list, "0", { writable: false });
    f.state.list.fill(9, 1, 3);
    f.state.list.copyWithin(2, 3);
    expect(raw.list).toEqual([3, 9, 0, 0]);
    expect(f.remote()).toEqual(raw);
    const odd = { list: [3, 2, 1] };
    const g = await fixture(odd, false);
    Object.defineProperty(odd.list, "1", { writable: false });
    // reverse leaves the middle of an odd length alone
    g.state.list.reverse();
    expect(odd.list).toEqual([1, 2, 3]);
    expect(g.remote()).toEqual(odd);
  });

  test("a non-configurable index a reorder would delete is refused before any write", async () => {
    const raw = { list: [3, , 1] as number[] };
    const f = await fixture(raw, false);
    Object.defineProperty(raw.list, "2", { configurable: false });
    // sort moves the hole to the end: index 2 would be deleted
    expect(() => f.state.list.sort()).toThrow(TypeError);
    expect(0 in raw.list && raw.list[0]).toBe(3);
    expect(1 in raw.list).toBe(false);
    expect(f.events).toHaveLength(0);
  });

  test("a non-extensible array refuses a reorder that fills a hole", async () => {
    const raw = { list: [3, , 1] as number[] };
    const f = await fixture(raw, false);
    Object.preventExtensions(raw.list);
    expect(() => f.state.list.fill(0)).toThrow(TypeError);
    expect(raw.list[0]).toBe(3);
    expect(1 in raw.list).toBe(false);
    expect(f.events).toHaveLength(0);
  });

  test("a reorder that only swaps 0 and -0 is a change, with one event", async () => {
    const raw = { list: [0, -0] };
    const f = await fixture(raw, false);
    f.state.list.reverse();
    expect([Object.is(raw.list[0], -0), Object.is(raw.list[1], 0)]).toEqual([true, true]);
    expect(f.events).toHaveLength(1);
    expect([Object.is(f.remote().list[0], -0), Object.is(f.remote().list[1], 0)]).toEqual([true, true]);
  });

  test("a reorder that moves only holes is a change, with one event", async () => {
    const raw = { list: [undefined, , 1] as any[] };
    const f = await fixture(raw, false);
    f.state.list.copyWithin(0, 1, 2);
    expect(0 in raw.list).toBe(false);
    expect(f.events).toHaveLength(1);
    expect(toRaw(f.state.list)).toBe(raw.list);
  });
});

describe("supported inputs keep the replica equal", () => {
  test("data objects, arrays, string Maps and primitive Sets replay", async () => {
    const f = await fixture(
      { item: { n: 0 }, list: [3, 1, 2], map: new Map([["a", { n: 0 }]]), set: new Set([1]) },
      false
    );
    f.state.item.n++;
    f.state.list.sort((a, b) => a - b);
    f.state.list.reverse();
    f.state.list.fill(4, 2);
    f.state.list.copyWithin(0, 1);
    f.state.map.get("a")!.n++;
    f.state.map.set("b", { n: 2 });
    f.state.set.add(2);
    f.state.set.delete(1);
    expect(f.remote()).toEqual({
      item: { n: 1 },
      list: [2, 4, 4],
      map: new Map([
        ["a", { n: 1 }],
        ["b", { n: 2 }],
      ]),
      set: new Set([2]),
    });
  });

  test("an own setter makes its own writes at every write; a data object emits each write", async () => {
    const raw: any = {
      n: 0,
      plain: { m: 0 },
      set value(next: number) {
        this.n = next;
      },
    };
    const f = await fixture(raw, false);
    f.state.value = 1;
    f.state.value = 2;
    f.state.plain.m = 1;
    f.state.plain.m = 2;
    expect(f.events.map((event) => `${event.path.join(".")}=${event.newValue}`)).toEqual([
      "n=1",
      "n=2",
      "plain.m=1",
      "plain.m=2",
    ]);
    expect(f.remote()).toEqual({ n: 2, plain: { m: 2 }, value: undefined });
  });

  test("a frozen object refuses a write and keeps its replica", async () => {
    const raw = Object.freeze({ n: 1 });
    const f = await fixture(raw, false);
    expect(() => {
      (f.state as any).n = 2;
    }).toThrow(TypeError);
    expect(f.remote()).toEqual(raw);
    expect(f.events).toHaveLength(0);
  });
});
