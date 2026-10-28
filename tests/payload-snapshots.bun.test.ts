import { describe, expect, test } from "bun:test";
import { reactive } from "../src/index";
import type { StateEvent } from "../src/types";
import { replicate } from "./replica";

/**
 * An event's payload is a deep copy made when the event is made. A later
 * write, before or after the event is delivered, cannot change it.
 */

function recorder<T extends object>(raw: T) {
  const events: StateEvent[] = [];
  const state = reactive(raw, (event) => events.push(event));
  events.length = 0; // drop the initial replace
  return { state, events };
}

function mapReplacer(_key: string, value: unknown) {
  if (value instanceof Map) return { map: [...value] };
  if (value instanceof Set) return { set: [...value] };
  return value;
}

/** Make the events, note their text, write more, and check the first events did not change. */
function expectFrozen<T extends object>(raw: T, act: (state: T) => void, later: (state: T) => void) {
  const { state, events } = recorder(raw);
  act(state);
  const count = events.length;
  expect(count).toBeGreaterThan(0);
  const before = JSON.stringify(events.slice(0, count), mapReplacer);
  later(state);
  expect(JSON.stringify(events.slice(0, count), mapReplacer)).toBe(before);
}

describe("event payloads are snapshots", () => {
  test("reorder oldValue keeps the items as they were", () => {
    expectFrozen(
      { list: [{ n: 0 }, { n: 1 }] },
      (state) => state.list.reverse(),
      (state) => {
        state.list[0].n = 5;
        state.list[1].n = 6;
      }
    );
  });

  test("sort, fill and copyWithin oldValue and newValue", () => {
    for (const act of [
      (state: any) => state.list.sort((left: any, right: any) => right.n - left.n),
      (state: any) => state.list.fill({ n: 9 }, 1),
      (state: any) => state.list.copyWithin(0, 1),
    ]) {
      expectFrozen({ list: [{ n: 0 }, { n: 1 }, { n: 2 }] }, act, (state: any) => {
        for (let i = 0; i < state.list.length; i++) state.list[i].n += 10;
      });
    }
  });

  test("push, unshift and splice items", () => {
    expectFrozen(
      { list: [] as any[] },
      (state) => {
        state.list.push({ items: [] });
        state.list.unshift({ items: [] });
        state.list.splice(1, 0, { items: [] });
      },
      (state) => {
        for (let i = 0; i < 3; i++) state.list[i].items.push(i);
      }
    );
  });

  test("items given as raw objects the caller keeps", () => {
    const item = { items: [] as number[] };
    expectFrozen(
      { list: [] as any[] },
      (state) => state.list.push(item),
      () => item.items.push(1)
    );
  });

  test("set and delete oldValue", () => {
    expectFrozen(
      { a: { n: 0 }, b: { n: 0 } } as any,
      (state) => {
        const a = state.a;
        const b = state.b;
        state.a = { n: 1 };
        delete state.b;
        (state as any).kept = [a, b];
      },
      (state) => {
        // the removed objects come back and change
        state.c = state.kept[0];
        state.d = state.kept[1];
        state.c.n = 7;
        state.d.n = 8;
      }
    );
  });

  test("pop, shift and splice removed values", () => {
    expectFrozen(
      { list: [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }], back: [] as any[] },
      (state) => {
        const first = state.list[0];
        const last = state.list[3];
        const middle = state.list[1];
        state.list.pop();
        state.list.shift();
        state.list.splice(0, 1);
        state.back = [first, last, middle];
      },
      (state) => {
        for (const entry of state.back) entry.n = 99;
      }
    );
  });

  test("map set, map delete, set add and set delete", () => {
    expectFrozen(
      { map: new Map<string, any>([["a", { n: 0 }]]), set: new Set<any>(), back: [] as any[] },
      (state) => {
        const old = state.map.get("a");
        state.map.set("a", { n: 1 });
        const member = { n: 2 };
        state.set.add(member);
        state.map.delete("a");
        state.set.delete(member);
        state.back = [old, member];
      },
      (state) => {
        for (const entry of state.back) entry.n = 99;
      }
    );
  });

  test("an object at two places: each event has its own copy", () => {
    const { state, events } = recorder({ list: [{ n: 0 }, null as any] });
    state.list[1] = state.list[0];
    events.length = 0;
    state.list[0].n = 1;
    expect(events.length).toBe(2);
    state.list[0] = { box: { n: 0 } } as any;
    state.list[1] = state.list[0];
    const pair = events.slice(-2);
    expect(pair.map((event) => event.path.join("."))).toEqual(["list.0", "list.1"]);
    // the two events of one write do not share payload objects
    expect(pair[0].oldValue).not.toBe(pair[1].oldValue);
  });
});

describe("deferred delivery replays to the same state", () => {
  test("push an item, then push into its array in the same tick", async () => {
    const sync = replicate({ list: [] as any[] }, { async: true });
    await Promise.resolve();
    sync.state.list.push({ items: [] });
    sync.state.list[0].items.push(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sync.inSync()).toBe(true);
  });

  test("splice-insert an item, then edit it in the same tick", async () => {
    const sync = replicate({ list: [{ id: "A", arr: [] as number[] }] }, { async: true });
    await Promise.resolve();
    sync.state.list.splice(1, 0, { id: "E", arr: [] });
    sync.state.list[1].arr.push(5);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sync.inSync()).toBe(true);
  });

  test("the initial replace is a snapshot too", async () => {
    const events: StateEvent[] = [];
    const raw = { list: [] as number[] };
    const state = reactive(raw, (event) => events.push(structuredClone(event)), [], { async: true });
    state.list.push(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events[0].action).toBe("replace");
    expect(events[0].newValue).toEqual({ list: [] });
  });

  test("reverse, then write an item before delivery: oldValue is the old order", async () => {
    const events: StateEvent[] = [];
    const state = reactive({ list: [{ n: 0 }, { n: 1 }] }, (event) => events.push(event), [], { async: true });
    await Promise.resolve();
    events.length = 0;
    state.list.reverse();
    state.list[0].n = 5;
    await Promise.resolve();
    expect(events[0].oldValue).toEqual([{ n: 0 }, { n: 1 }]);
    expect(events[0].newValue).toEqual([{ n: 1 }, { n: 0 }]);
  });
});
