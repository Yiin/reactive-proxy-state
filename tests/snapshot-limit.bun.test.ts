import { describe, expect, test } from "bun:test";
import { SnapshotLimitError, getProxyStats, reactive, toRaw, updateState, watchEffect } from "../src/index";
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

describe("a refusal needs no rollback", () => {
  // the review's regressions: a refusal that put the container back after
  // the write lost child places, broke on a non-configurable index and
  // restarted live iterators
  for (const async of [false, true]) {
    for (const method of ["reverse", "sort", "fill", "copyWithin"] as const) {
      test(`refused ${method} keeps cyclic child locations, async=${async}`, async () => {
        const raw: any[] = [];
        const child: any = { n: 0, back: raw };
        raw.push(child, { n: 1 });
        const events: any[] = [];
        const state: any = reactive(raw, (event) => events.push(event), [], { async });
        const held = state[0];
        state.push(dag(15));
        state.push(dag(15));
        await Promise.resolve();
        events.length = 0;
        const before = raw.slice();
        const act = () =>
          method === "sort"
            ? state.sort((left: any, right: any) => (right.n ?? 9) - (left.n ?? 9))
            : method === "fill"
              ? state.fill({ n: 3 }, 0, 1)
              : method === "copyWithin"
                ? state.copyWithin(0, 1, 2)
                : state.reverse();
        expect(act).toThrow(SnapshotLimitError);
        expect(raw.every((item, index) => item === before[index])).toBe(true);
        await Promise.resolve();
        expect(events.length).toBe(0);
        held.n = 7;
        await Promise.resolve();
        expect(events.map((event) => event.path)).toEqual([["0", "n"]]);
      });
    }
  }

  test("a non-configurable index survives a refused write that reaches back into its array", () => {
    const child = { n: 1 };
    const raw: any[] = [0, child];
    Object.defineProperty(raw, "0", { configurable: false });
    const events: unknown[] = [];
    const state: any = reactive(raw, (event) => events.push(event));
    events.length = 0;
    let error: any;
    try {
      state[1] = { back: raw, data: dag(17) };
    } catch (caught) {
      error = caught;
    }
    expect({ error: error?.name, length: raw.length, child: raw[1] === child, events: events.length }).toEqual({
      error: "SnapshotLimitError",
      length: 2,
      child: true,
      events: 0,
    });
  });

  for (const kind of ["map", "set"] as const) {
    test(`a refused ${kind} insertion keeps an active iterator`, () => {
      const raw: any = kind === "map" ? new Map([["a", 1], ["b", 2]]) : new Set([1, 2]);
      const state: any = reactive(raw, () => {});
      const iterator = state.values();
      expect(iterator.next().value).toBe(1);
      const value = { back: raw, data: dag(17) };
      expect(() => (kind === "map" ? state.set("new", value) : state.add(value))).toThrow(SnapshotLimitError);
      expect([...iterator]).toEqual([2]);
    });
  }

  /** What `container` holds: entries, members, or own keys with their descriptors. */
  function contents(container: any): unknown[] {
    if (container instanceof Map) return [...container].flat();
    if (container instanceof Set) return [...container];
    return Reflect.ownKeys(container).flatMap((key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(container, key)!;
      return [key, descriptor.value, descriptor.writable, descriptor.enumerable, descriptor.configurable];
    });
  }

  type WritePath = {
    name: string;
    make: () => any;
    /** Stores a value through the raw object, before the proxies are made. */
    setup?: (raw: any) => unknown;
    write: (state: any, raw: any) => unknown;
  };
  /** Every write path, storing or removing `reaching(container)`, a value that points back into its container. */
  const writePaths = (reaching: (container: object) => object): WritePath[] => [
    { name: "object set", make: () => ({ a: 1 }), write: (state, raw) => (state.b = reaching(raw)) },
    {
      name: "object set over an old value that reaches back",
      make: () => ({ a: 1 }),
      setup: (raw) => (raw.b = reaching(raw)),
      write: (state) => (state.b = 2),
    },
    {
      name: "object delete",
      make: () => ({ a: 1 }),
      setup: (raw) => (raw.b = reaching(raw)),
      write: (state) => delete state.b,
    },
    { name: "array index write", make: () => [1, 2], write: (state, raw) => (state[1] = reaching(raw)) },
    { name: "array index write past the end", make: () => [1, 2], write: (state, raw) => (state[4] = reaching(raw)) },
    {
      name: "array delete",
      make: () => [1, 2],
      setup: (raw) => raw.push(reaching(raw)),
      write: (state) => delete state[2],
    },
    { name: "push", make: () => [1, 2], write: (state, raw) => state.push(reaching(raw)) },
    { name: "unshift", make: () => [1, 2], write: (state, raw) => state.unshift(reaching(raw)) },
    { name: "splice insertion", make: () => [1, 2], write: (state, raw) => state.splice(1, 0, reaching(raw)) },
    {
      name: "splice removal",
      make: () => [1, 2],
      setup: (raw) => raw.push(reaching(raw)),
      write: (state) => state.splice(2, 1),
    },
    { name: "pop", make: () => [1, 2], setup: (raw) => raw.push(reaching(raw)), write: (state) => state.pop() },
    { name: "shift", make: () => [1, 2], setup: (raw) => raw.unshift(reaching(raw)), write: (state) => state.shift() },
    {
      name: "map set",
      make: () => new Map<any, any>([["a", 1]]),
      write: (state, raw) => state.set("b", reaching(raw)),
    },
    {
      name: "map delete",
      make: () => new Map<any, any>([["a", 1]]),
      setup: (raw) => raw.set("b", reaching(raw)),
      write: (state) => state.delete("b"),
    },
    { name: "set add", make: () => new Set<any>([1]), write: (state, raw) => state.add(reaching(raw)) },
    {
      name: "set delete",
      make: () => new Set<any>([1]),
      setup: (raw) => raw.add(reaching(raw)),
      write: (state, raw) => state.delete([...raw].find((member: any) => typeof member === "object")),
    },
  ];

  /** A value that points back into `container` and is too large to copy. */
  const tooLarge = (container: object) => ({ back: container, data: dag(17) });

  for (const { name, make, setup, write } of writePaths(tooLarge)) {
    test(`${name}: a refused payload that reaches back into its container writes nothing`, () => {
      const child = { n: 1 };
      const raw = make();
      const collection = raw instanceof Map || raw instanceof Set;
      // a non-configurable property, which a delete-and-redefine rollback cannot restore
      if (!collection) Object.defineProperty(raw, "0", { configurable: false });
      const events: any[] = [];
      const state: any = reactive({ child, box: raw }, (event) => events.push(event));
      // stored raw, after the root: a root over the limit is refused
      setup?.(raw);
      const box = state.box;
      const held = state.child;
      const iterator = collection ? box.values() : undefined;
      iterator?.next();
      events.length = 0;
      const before = contents(raw);
      let error: unknown;
      try {
        write(box, raw);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(SnapshotLimitError);
      const after = contents(raw);
      expect(after.length).toBe(before.length);
      for (let i = 0; i < before.length; i++) expect(after[i]).toBe(before[i]);
      expect(events.length).toBe(0);
      if (iterator !== undefined) expect([...iterator].length).toBe(raw.size - 1);
      held.n = 2;
      expect(events.map((event) => event.path)).toEqual([["child", "n"]]);
    });
  }

  /**
   * A text form of a graph that keeps cycles (`^n` names the ancestor n steps
   * up) and every object at each of its places, like a payload copy.
   */
  function shape(value: unknown, ancestors: object[] = []): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
    const index = ancestors.lastIndexOf(value);
    if (index >= 0) return `^${ancestors.length - index}`;
    ancestors.push(value);
    let text: string;
    if (Array.isArray(value)) text = `[${Array.from(value, (item) => shape(item, ancestors)).join(",")}]`;
    else if (value instanceof Map)
      text = `Map{${[...value].map(([key, item]) => `${shape(key, ancestors)}=>${shape(item, ancestors)}`).join(",")}}`;
    else if (value instanceof Set) text = `Set{${[...value].map((item) => shape(item, ancestors)).join(",")}}`;
    else text = `{${Object.keys(value).map((key) => `${key}:${shape((value as any)[key], ancestors)}`).join(",")}}`;
    ancestors.pop();
    return text;
  }

  // the value the current write path stores or removes
  let stored: any;
  const small = (container: object) => (stored = { back: container, list: [1, { n: 2 }] });

  for (const { name, make, setup, write } of writePaths(small)) {
    test(`${name}: a payload that reaches back into its container is the copy the write leaves`, () => {
      const raw = make();
      const fields = ["newValue", "oldValue", "value", "items", "oldValues"];
      const events: any[] = [];
      const expected: string[] = [];
      const state: any = reactive({ box: raw }, (event: any) => {
        events.push(event);
        // made synchronously right after the write: what a copy after the write holds
        for (const field of fields) {
          const payload = event[field];
          if (payload === null || typeof payload !== "object") continue;
          const live = field === "items" || field === "oldValues" ? [stored] : stored;
          expected.push(`${field}:${shape(cloneTree(live))}`);
        }
      });
      setup?.(raw);
      events.length = 0;
      expected.length = 0;
      write(state.box, raw);
      expect(events.length).toBe(1);
      const actual = fields
        .filter((field) => events[0][field] !== null && typeof events[0][field] === "object")
        .map((field) => `${field}:${shape(events[0][field])}`);
      expect(actual.length).toBeGreaterThan(0);
      expect(actual).toEqual(expected);
    });
  }

  for (const method of ["reverse", "sort", "fill", "copyWithin"] as const) {
    test(`${method}: the payload is the copy the reorder leaves`, () => {
      const raw: any[] = [];
      raw.push({ n: 0, back: raw }, { n: 1, list: [raw] }, { n: 2 }, [raw]);
      const before = raw.slice();
      let expected: string[] = [];
      const events: any[] = [];
      const state: any = reactive(raw, (event: any) => {
        events.push(event);
        expected = [shape(cloneTree(raw)), shape(cloneTree(before))];
      });
      events.length = 0;
      if (method === "sort") state.sort((left: any, right: any) => (right.n ?? 9) - (left.n ?? 9));
      else if (method === "fill") state.fill(raw[1], 0, 1);
      else if (method === "copyWithin") state.copyWithin(0, 1, 3);
      else state.reverse();
      expect(events.length).toBe(1);
      expect([shape(events[0].newValue), shape(events[0].oldValue)]).toEqual(expected);
    });
  }

  test("a reorder keeps the native checks: a frozen array or item throws a TypeError and sends nothing", () => {
    const events: unknown[] = [];
    const state: any = reactive(
      { frozen: Object.freeze([{ n: 2 }, { n: 1 }]), sorted: Object.freeze([1, 2]), item: [3, 1, 2] },
      (event) => events.push(event)
    );
    events.length = 0;
    Object.defineProperty(toRaw(state.item), "0", { writable: false });
    for (const method of ["sort", "reverse"] as const) {
      expect(() => state.frozen[method]((left: any, right: any) => left.n - right.n)).toThrow(TypeError);
      // native sort writes every index back, also when nothing moves
      expect(() => state.sorted[method]()).toThrow(TypeError);
      expect(() => state.item[method]()).toThrow(TypeError);
    }
    expect(toRaw(state.item)[0]).toBe(3);
    expect(events.length).toBe(0);
  });
});

describe("a cyclic graph too large to remove in parts", () => {
  test("every removal is refused; a new root from new objects resets the replica", () => {
    const sync = replicate({ keep: { n: 1 }, graph: null as any });
    // ten objects, each holding the nine others, stored raw: every part reaches the whole graph
    const nodes = Array.from({ length: 10 }, (_, i) => ({ i }) as any);
    for (const node of nodes) for (const other of nodes) if (other !== node) node["to" + other.i] = other;
    (toRaw(sync.state) as any).graph = nodes[0];
    let error: unknown;
    try {
      sync.state.graph = null;
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SnapshotLimitError);
    expect(String((error as Error).message)).toContain('"Synchronization Limits" in the README');
    expect(() => delete (sync.state as any).graph).toThrow(SnapshotLimitError);
    expect(() => delete sync.state.graph.to1).toThrow(SnapshotLimitError);
    expect(sync.events.length).toBe(0);

    // the way out: the state again from new objects, without the graph, under a new root
    (toRaw(sync.state) as any).added = { raw: true }; // another raw write the replica missed
    const next = structuredClone({ ...toRaw(sync.state), graph: null });
    expect(treeText(sync.remote)).not.toBe(treeText(next));
    const events: string[] = [];
    const state = reactive(next, (event) => {
      events.push(`${event.action}:${event.path.join(".")}`);
      updateState(sync.remote, structuredClone(event));
    });
    state.keep.n = 2;
    expect(events).toEqual(["replace:", "set:keep.n"]);
    expect(treeText(sync.remote)).toBe(treeText(next));
    expect((sync.remote as any).keep.n).toBe(2);
  });
});
