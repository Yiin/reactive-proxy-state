import { describe, expect, test } from "bun:test";
import { SnapshotLimitError, reactive, toRaw, updateState } from "../src/index";
import { SNAPSHOT_SHARED_COPY_LIMIT, cloneTree } from "../src/utils";
import type { StateEvent } from "../src/types";
import { replicate } from "./replica";

/**
 * What a write stores (`newValue`, `value`, `items`) is a deep copy made
 * when the event is made: a later write, before or after the event is
 * delivered, cannot change it. What a write removes (`oldValue`,
 * `oldValues`) is a copy for an async root, whose events wait; a
 * synchronous root sends the removed value itself, as 1.0.44 did.
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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The events `act` makes on an async root, delivered after `later` wrote
 * more, read as the events a synchronous root delivers at once.
 */
async function expectFrozenAsync<T extends object>(
  make: () => T,
  act: (state: T) => void,
  later: (state: T) => void
) {
  const delivered: string[] = [];
  const now = reactive(make(), (event) => delivered.push(JSON.stringify(event, mapReplacer)));
  delivered.length = 0;
  act(now);
  expect(delivered.length).toBeGreaterThan(0);

  const events: StateEvent[] = [];
  const state = reactive(make(), (event) => events.push(event), [], { async: true });
  await flush();
  events.length = 0;
  act(state);
  later(state);
  await flush();
  expect(events.slice(0, delivered.length).map((event) => JSON.stringify(event, mapReplacer))).toEqual(delivered);
}

describe("event payloads are snapshots", () => {
  test("reorder oldValue keeps the items as they were (async root)", async () => {
    await expectFrozenAsync(
      () => ({ list: [{ n: 0 }, { n: 1 }] }),
      (state) => state.list.reverse(),
      (state) => {
        state.list[0].n = 5;
        state.list[1].n = 6;
      }
    );
  });

  test("sort, fill and copyWithin oldValue and newValue (async root)", async () => {
    for (const act of [
      (state: any) => state.list.sort((left: any, right: any) => right.n - left.n),
      (state: any) => state.list.fill({ n: 9 }, 1),
      (state: any) => state.list.copyWithin(0, 1),
    ]) {
      await expectFrozenAsync(() => ({ list: [{ n: 0 }, { n: 1 }, { n: 2 }] }), act, (state: any) => {
        for (let i = 0; i < state.list.length; i++) state.list[i].n += 10;
      });
    }
  });

  test("sort, fill and copyWithin newValue", () => {
    for (const act of [
      (state: any) => state.list.sort((left: any, right: any) => right.n - left.n),
      (state: any) => state.list.fill({ n: 9 }, 1),
      (state: any) => state.list.copyWithin(0, 1),
    ]) {
      const { state, events } = recorder({ list: [{ n: 0 }, { n: 1 }, { n: 2 }] });
      act(state);
      const count = events.length;
      const before = JSON.stringify(events.map((event) => event.newValue));
      for (let i = 0; i < state.list.length; i++) state.list[i].n += 10;
      expect(JSON.stringify(events.slice(0, count).map((event) => event.newValue))).toBe(before);
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

  test("set and delete oldValue (async root)", async () => {
    await expectFrozenAsync(
      () => ({ a: { n: 0 }, b: { n: 0 } }) as any,
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

  test("pop, shift and splice removed values (async root)", async () => {
    await expectFrozenAsync(
      () => ({ list: [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }], back: [] as any[] }),
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

  test("map set, map delete, set add and set delete (async root)", async () => {
    await expectFrozenAsync(
      () => ({ map: new Map<string, any>([["a", { n: 0 }]]), set: new Set<any>(), back: [] as any[] }),
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
    const { state, events } = recorder({ list: [{ box: { n: 0 } }, null as any] });
    state.list[1] = state.list[0];
    events.length = 0;
    state.list[0].box = { n: 1 };
    const pair = events.slice(-2);
    expect(pair.map((event) => event.path.join("."))).toEqual(["list.0.box", "list.1.box"]);
    // the two events of one write do not share payload objects
    expect(pair[0].newValue).not.toBe(pair[1].newValue);
    expect(pair[0].newValue).toEqual(pair[1].newValue);
  });

  test("an object at two places: each event of an async root has its own removed copy", async () => {
    const events: StateEvent[] = [];
    const state = reactive({ list: [{ box: { n: 0 } }, null as any] }, (event) => events.push(event), [], {
      async: true,
    });
    state.list[1] = state.list[0];
    await flush();
    events.length = 0;
    state.list[0].box = { n: 1 };
    await flush();
    expect(events.map((event) => event.path.join("."))).toEqual(["list.0.box", "list.1.box"]);
    expect(events[0].oldValue).not.toBe(events[1].oldValue);
    expect(events[0].oldValue).toEqual({ n: 0 });
  });

  test("a synchronous root sends what a write removes as it is, as 1.0.44 did", () => {
    const { state, events } = recorder({ a: { n: 0 }, list: [{ n: 1 }, { n: 2 }] } as any);
    const a = toRaw(state).a;
    const second = toRaw(state).list[1];
    state.a = { n: 5 };
    state.list.pop();
    expect(events[0].oldValue).toBe(a);
    expect(events[1].oldValue).toBe(second);
    // what it stores is a copy
    expect(events[0].newValue).not.toBe(toRaw(state).a);
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

/** A graph of `depth + 1` objects where each level holds the one below twice: 2^(depth+1) - 1 places. */
function doubling(depth: number): any {
  let value: any = { n: 0 };
  for (let i = 0; i < depth; i++) value = { left: value, right: value };
  return value;
}

function countObjects(value: any): number {
  if (value === null || typeof value !== "object") return 0;
  let count = 1;
  for (const key of Object.keys(value)) count += countObjects(value[key]);
  return count;
}

describe("objects shared inside one snapshot", () => {
  test("a pushed value with one object at two places replays through a wire that keeps identity", () => {
    // structuredClone keeps shared identity, so a payload that shared the
    // object would make the replica push twice into one array
    const sync = replicate({ list: [] as any[] });
    const shared = { items: [] as number[] };
    sync.state.list.push({ a: shared, b: shared });
    sync.state.list[0].a.items.push(1);
    expect(sync.paths()).toEqual(["array-push:list", "array-push:list.0.a.items", "array-push:list.0.b.items"]);
    expect(sync.inSync()).toBe(true);
  });

  test("the initial snapshot of a shared graph under the limit is a tree", () => {
    const events: StateEvent[] = [];
    const state = reactive(doubling(10), (event) => events.push(structuredClone(event)));
    const payload = events[0].newValue;
    expect(payload.left).not.toBe(payload.right);
    expect(countObjects(payload)).toBe(2 ** 11 - 1);
    let leaf: any = state;
    for (let i = 0; i < 10; i++) leaf = leaf.left;
    leaf.n = 5;
    expect(events.length).toBe(1 + 2 ** 10); // one event per place of the leaf
    const remote = payload;
    for (const event of events.slice(1)) updateState(remote, event);
    expect(JSON.stringify(remote)).toBe(JSON.stringify(toRaw(state)));
  });

  test("a large tree with a cycle is not limited", () => {
    const raw: any = { items: [] };
    for (let i = 0; i < 30_000; i++) raw.items.push({ i, tags: [i] });
    raw.self = raw;
    raw.items[29_999].back = raw.items;
    let payload: any;
    reactive(raw, (event) => (payload = event.newValue));
    expect(payload.items.length).toBe(30_000);
    expect(payload.self).toBe(payload);
    expect(payload.items[29_999].back).toBe(payload.items);
    expect(payload).not.toBe(raw);
  });

  test("a root whose snapshot would copy too many shared objects is refused before a proxy exists", () => {
    const raw = doubling(21); // 22 objects, 4,194,303 places
    const events: StateEvent[] = [];
    const started = performance.now();
    expect(() => reactive(raw, (event) => events.push(event))).toThrow(SnapshotLimitError);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(events).toEqual([]);
    // no proxy was cached for the refused root
    const plain = reactive(raw);
    expect(toRaw(plain)).toBe(raw);
    expect(plain).not.toBe(raw);
  });

  test("a shared graph with cycles over the limit is refused too", () => {
    const raw = doubling(21);
    let level = raw;
    while (level.left !== undefined) {
      level.top = raw;
      level = level.left;
    }
    expect(() => reactive(raw, () => {})).toThrow(RangeError);
  });

  test("a write whose payload would copy too many shared objects throws and sends nothing", () => {
    const { state, events } = recorder({ box: null as any });
    expect(() => {
      state.box = doubling(21);
    }).toThrow(RangeError);
    expect(events).toEqual([]);
  });

  test("the limit counts copies beyond the first copy of each object", () => {
    const exact = { list: new Array(SNAPSHOT_SHARED_COPY_LIMIT + 1).fill({ n: 0 }) };
    const copy = cloneTree(exact);
    expect(copy.list.length).toBe(SNAPSHOT_SHARED_COPY_LIMIT + 1);
    expect(copy.list[0]).not.toBe(copy.list[1]);

    const over = { list: new Array(SNAPSHOT_SHARED_COPY_LIMIT + 2).fill({ n: 0 }) };
    expect(() => cloneTree(over)).toThrow(RangeError);
  });
});
