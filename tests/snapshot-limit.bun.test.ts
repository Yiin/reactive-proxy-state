import { describe, expect, test } from "bun:test";
import { SnapshotLimitError, getProxyStats, reactive, toRaw, watchEffect } from "../src/index";
import { cloneTree } from "../src/utils";
import { replicate, treeText } from "./replica";

/**
 * The copy limit (`SNAPSHOT_SHARED_COPY_LIMIT`): a write whose payload is
 * too large to copy is refused before anything changes, one payload has
 * one budget, and a graph below the limit is never refused.
 */

/** `depth + 1` objects, each level holding the one below twice: 2^(depth+1) - 1 copies. */
function dag(depth: number): any {
  let value: any = { n: 0 };
  for (let i = 0; i < depth; i++) value = { a: value, b: value };
  return value;
}

/** A replica of `raw`, an effect on every top-level key, and a check that nothing moved. */
function guarded<T extends object>(raw: T) {
  const sync = replicate(raw);
  let effectRuns = 0;
  watchEffect(() => {
    effectRuns++;
    for (const key of Object.keys(sync.state)) void (sync.state as any)[key];
  });
  const text = treeText(raw);
  const runs = effectRuns;
  const evicted = getProxyStats().staleEvicted;
  return {
    ...sync,
    /** `write` throws a SnapshotLimitError and leaves state, events, effects and caches as they were. */
    expectRefused(write: (state: T) => unknown) {
      const eventCount = sync.events.length;
      expect(() => write(sync.state)).toThrow(SnapshotLimitError);
      expect(treeText(raw)).toBe(text);
      expect(sync.events.length).toBe(eventCount);
      expect(effectRuns).toBe(runs);
      expect(getProxyStats().staleEvicted).toBe(evicted);
    },
  };
}

describe("a refused write changes nothing", () => {
  test("property set: the reviewer's case", () => {
    const events: unknown[] = [];
    const state = reactive({ box: null as any }, (event) => events.push(event));
    events.length = 0;
    expect(() => {
      state.box = dag(17);
    }).toThrow(SnapshotLimitError);
    expect(events.length).toBe(0);
    expect(state.box).toBe(null);
    // restoring the old value is a no-op now, not a second refusal
    state.box = null;
    expect(events.length).toBe(0);
  });

  test("property set and delete keep the old value, its proxy and its places", () => {
    const sync = guarded({ box: { items: [{ n: 1 }] } as any, other: 0 });
    const held = sync.state.box.items[0];
    sync.expectRefused((state) => {
      state.box = dag(17);
    });
    expect(sync.state.box.items[0]).toBe(held);
    held.n = 2;
    expect(sync.paths()).toEqual(["set:box.items.0.n"]);
    expect(sync.inSync()).toBe(true);

    // a value too large to copy as oldValue, stored raw
    (toRaw(sync.state) as any).big = dag(17);
    const raw = toRaw(sync.state) as any;
    expect(() => {
      delete (sync.state as any).big;
    }).toThrow(SnapshotLimitError);
    expect("big" in raw).toBe(true);
    expect(() => {
      (sync.state as any).big = null;
    }).toThrow(SnapshotLimitError);
    expect(raw.big.a).toBeDefined();
  });

  test("whole-array replacement whose items share one graph", () => {
    const sync = guarded({ list: [{ id: 1 }] as any[] });
    const value = dag(15);
    sync.expectRefused((state) => {
      state.list = [value, value, value];
    });
  });

  test("array index write, splice, push and unshift", () => {
    const sync = guarded({ list: [{ id: 1 }, { id: 2 }] as any[] });
    const held = sync.state.list[1];
    sync.expectRefused((state) => {
      state.list[0] = dag(17);
    });
    sync.expectRefused((state) => {
      state.list[5] = dag(17);
    });
    sync.expectRefused((state) => state.list.splice(0, 1, dag(17)));
    sync.expectRefused((state) => state.list.push(dag(17)));
    sync.expectRefused((state) => state.list.unshift(dag(17)));
    expect(sync.state.list[1]).toBe(held);
    held.id = 3;
    expect(sync.paths()).toEqual(["set:list.1.id"]);
    expect(sync.inSync()).toBe(true);
  });

  test("pop, shift and splice of an item too large to copy", () => {
    const sync = guarded({ list: [{ id: 1 }, { id: 2 }] as any[] });
    const raw = toRaw(sync.state.list) as any[];
    raw.unshift(dag(17));
    raw.push(dag(17));
    const length = raw.length;
    expect(() => sync.state.list.pop()).toThrow(SnapshotLimitError);
    expect(() => sync.state.list.shift()).toThrow(SnapshotLimitError);
    expect(() => sync.state.list.splice(0, 2)).toThrow(SnapshotLimitError);
    expect(raw.length).toBe(length);
    expect(raw[1].id).toBe(1);
  });

  test("sort, reverse, fill and copyWithin", () => {
    const sync = guarded({ list: [{ id: 2 }, { id: 1 }, { id: 3 }] as any[] });
    const raw = toRaw(sync.state.list) as any[];
    const value = dag(15);
    raw.push(value, value);
    const order = raw.slice();
    const refused = (write: () => unknown) => {
      expect(write).toThrow(SnapshotLimitError);
      expect(raw).toEqual(order);
      for (let i = 0; i < order.length; i++) expect(raw[i]).toBe(order[i]);
    };
    refused(() => sync.state.list.sort((left: any, right: any) => (left.id ?? 9) - (right.id ?? 9)));
    refused(() => sync.state.list.reverse());
    refused(() => sync.state.list.fill({ id: 0 }, 0, 1));
    refused(() => sync.state.list.copyWithin(0, 1, 2));
    expect(sync.events.length).toBe(0);
  });

  test("map set, map delete, set add and set delete", () => {
    const sync = guarded({ map: new Map<string, any>([["a", { n: 1 }]]), set: new Set<any>([1]) });
    sync.expectRefused((state) => state.map.set("b", dag(17)));
    sync.expectRefused((state) => state.map.set("a", dag(17)));
    sync.expectRefused((state) => state.set.add(dag(17)));
    expect(sync.state.map.size).toBe(1);
    expect(sync.state.set.size).toBe(1);

    const big = dag(17);
    (toRaw(sync.state.map) as Map<string, any>).set("big", big);
    (toRaw(sync.state.set) as Set<any>).add(big);
    expect(() => sync.state.map.delete("big")).toThrow(SnapshotLimitError);
    expect(() => sync.state.set.delete(big)).toThrow(SnapshotLimitError);
    expect((toRaw(sync.state.map) as Map<string, any>).get("big")).toBe(big);
    expect((toRaw(sync.state.set) as Set<any>).has(big)).toBe(true);
    expect(sync.events.length).toBe(0);
  });

  test("a payload that reaches back into the written container is measured after the write", () => {
    // the item holds the list it is pushed into: a refusal restores the list
    const events: unknown[] = [];
    const state = reactive({ list: [{ id: 1 }] as any[] }, (event) => events.push(event));
    events.length = 0;
    const list = toRaw(state.list);
    expect(() => state.list.push({ back: list, data: dag(17) })).toThrow(SnapshotLimitError);
    expect(list.length).toBe(1);
    expect(Object.keys(list)).toEqual(["0"]);
    expect(events.length).toBe(0);

    // the object a new value points back to is over the limit before the
    // write and under it after: the write is accepted
    const shared = dag(15); // one place is under the limit, two are over it
    const holder = reactive({ obj: { b: shared } as any }, (event) => events.push(event));
    events.length = 0;
    const obj = toRaw(holder.obj);
    obj.c = shared;
    holder.obj.c = { parent: obj };
    expect(obj.c.parent).toBe(obj);
    expect(events.length).toBe(1);
    const payload = (events[0] as any).newValue;
    expect(payload.parent.c).toBe(payload);
    expect(payload.parent.b.a.a).toEqual(shared.a.a);
    expect(payload.parent.b).not.toBe(shared);
  });

  test("a length write has no payload to copy and is never refused", () => {
    const sync = guarded({ list: [{ id: 1 }] as any[] });
    (toRaw(sync.state.list) as any[]).push(dag(17));
    sync.state.list.length = 1;
    expect(sync.paths()).toEqual(["set:list.length"]);
    sync.state.list.length = 3;
    expect(sync.paths()).toEqual(["set:list.length", "set:list.1", "set:list.2"]);
  });
});

describe("one payload, one budget", () => {
  test("push of one shared graph three times is one payload", () => {
    const state = reactive({ list: [] as any[] }, () => {});
    const value = dag(15); // 65,535 copies, 65,519 extra; three places pass the limit
    expect(() => state.list.push(value, value, value)).toThrow(SnapshotLimitError);
    expect(() => state.list.unshift(value, value, value)).toThrow(SnapshotLimitError);
    expect(() => state.list.splice(0, 0, value, value, value)).toThrow(SnapshotLimitError);
    expect(toRaw(state.list).length).toBe(0);
  });

  test("items still get one copy per place", () => {
    const events: any[] = [];
    const state = reactive({ list: [] as any[] }, (event) => events.push(event));
    const value = { n: 1 };
    state.list.push(value, value);
    expect(events[1].items[0]).toEqual({ n: 1 });
    expect(events[1].items[0]).not.toBe(events[1].items[1]);
    expect(events[1].items[0]).not.toBe(value);
  });
});

describe("cycles are counted with their ancestors", () => {
  test("a two-object cycle repeated beside distinct objects stays below the limit", () => {
    const a: any = {};
    const b: any = {};
    a.b = b;
    b.a = a;
    // padding + 2 objects per item + root + both arrays: 110,005 copies of 30,005 objects
    const raw = { padding: Array.from({ length: 30_000 }, () => ({})), items: [a, ...new Array(40_000).fill(b)] };
    const copy = cloneTree(raw);
    expect(copy.items[1].a.b).toBe(copy.items[1]);
    expect(copy.items[1]).not.toBe(copy.items[2]);
  });

  test("a long cycle repeated beside distinct objects: a root below the limit is accepted", () => {
    // a ring of 800 objects; the list holds the first once and the second
    // 100 times: 80,000 extra copies, and a count that reuses the first
    // object's count at the other places (ancestors there) made 159,900
    const ring = Array.from({ length: 800 }, (_, i) => ({ i }) as any);
    for (let i = 0; i < ring.length; i++) ring[i].next = ring[(i + 1) % ring.length];
    const raw = { padding: Array.from({ length: 30_000 }, () => ({})), items: [ring[0], ...new Array(100).fill(ring[1])] };
    let payload: any;
    reactive(raw, (event) => (payload = event.newValue));
    expect(payload.items[1].i).toBe(1);
    expect(payload.items[1]).not.toBe(payload.items[2]);
    let last = payload.items[1];
    for (let i = 0; i < 799; i++) last = last.next;
    expect(last.next).toBe(payload.items[1]);
  });

  test("the same cycle repeated past the limit is refused", () => {
    const a: any = {};
    const b: any = {};
    a.b = b;
    b.a = a;
    const raw = { items: [a, ...new Array(50_001).fill(b)] };
    expect(() => cloneTree(raw)).toThrow(SnapshotLimitError);
  });
});
