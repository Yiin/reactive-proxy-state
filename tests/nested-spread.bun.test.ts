import { describe, expect, test } from "bun:test";
import { deepToRaw, isReactive, reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";
import { ReactiveFlags } from "../src/constants";

/**
 * `{ ...proxy, meta: { ...proxy.meta } }` leaves proxies below the top of a
 * stored value. The store puts their raw objects in the state, so a read
 * never wraps a proxy again (no chain grows), and every write finds its
 * place. A container the store cannot write (frozen, sealed, a getter)
 * keeps what it holds, and the store does not throw.
 */

function chainDepth(value: any): number {
  let depth = 0;
  let current = value;
  while (current && current[ReactiveFlags.RAW]) {
    depth++;
    current = current[ReactiveFlags.RAW];
  }
  return depth;
}

function embeddedProxies(value: any, seen = new Set<object>()): number {
  if (value === null || typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  if (value[ReactiveFlags.IS_REACTIVE]) return 1;
  let count = 0;
  if (value instanceof Map) for (const item of value.values()) count += embeddedProxies(item, seen);
  else if (value instanceof Set) for (const item of value) count += embeddedProxies(item, seen);
  else for (const key of Object.keys(value)) count += embeddedProxies(value[key], seen);
  return count;
}

function farmList(id: number, slots: number) {
  return {
    id,
    lastUpdated: 0,
    meta: { scan: { by: "bot", at: 0 } },
    slots: Array.from({ length: slots }, (_, i) => ({ id: i, lastRaid: { loot: i } })),
  };
}

describe("a nested spread stored again and again", () => {
  const CYCLES = 30;
  const patterns: [string, (state: any, index: number, cycle: number) => void][] = [
    [
      "splice",
      (state, index, cycle) => {
        const existing = state.farmLists[index];
        state.farmLists.splice(index, 1, { ...existing, meta: { ...existing.meta, at: cycle }, lastUpdated: cycle });
      },
    ],
    [
      "index set",
      (state, index, cycle) => {
        const existing = state.farmLists[index];
        state.farmLists[index] = { ...existing, meta: { ...existing.meta, at: cycle }, lastUpdated: cycle };
      },
    ],
  ];
  for (const [name, cycle] of patterns) {
    for (const listening of [true, false]) {
      test(`${name}, ${listening ? "with" : "without"} a listener: no chain, no proxy in the state`, () => {
        const initial = { farmLists: [farmList(1, 5), farmList(2, 5)] };
        const state: any = listening ? reactive(initial, () => {}) : reactive(initial);
        JSON.stringify(state);
        for (let round = 0; round < CYCLES; round++) {
          for (let index = 0; index < 2; index++) cycle(state, index, round);
        }
        expect(chainDepth(state.farmLists[0].meta.scan)).toBe(1);
        expect(chainDepth(state.farmLists[1].slots[0].lastRaid)).toBe(1);
        expect(embeddedProxies(toRaw(state))).toBe(0);
      });
    }
  }
});

describe("writes after a nested spread", () => {
  function fixture() {
    const initial = { lists: [{ id: 1, inner: { lastRaid: { id: "r", loot: 1 } }, slots: [{ id: 1 }] }] };
    const events: StateEvent[] = [];
    let replica: any;
    const state: any = reactive(structuredClone(initial), (event) => {
      if (event.action === "replace" && event.path.length === 0) {
        replica = structuredClone(deepToRaw(event.newValue));
        return;
      }
      events.push(event);
      updateState(replica, structuredClone(event));
    });
    return {
      state,
      events,
      paths: () => events.map((event) => `${event.action}:${event.path.join(".")}`),
      inSync: () => JSON.stringify(toRaw(state)) === JSON.stringify(replica),
    };
  }

  test("a write through a fresh read emits one event", () => {
    const sync = fixture();
    for (let cycle = 0; cycle < 3; cycle++) {
      const existing = sync.state.lists[0];
      sync.state.lists[0] = { ...existing, inner: { ...existing.inner }, cycle };
    }
    sync.events.length = 0;
    sync.state.lists[0].inner.lastRaid.loot = 99;
    expect(sync.paths()).toEqual(["set:lists.0.inner.lastRaid.loot"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a write through a reference read before the spreads emits one event", () => {
    const sync = fixture();
    const lastRaid = sync.state.lists[0].inner.lastRaid;
    for (let cycle = 0; cycle < 3; cycle++) {
      const existing = sync.state.lists[0];
      sync.state.lists[0] = { ...existing, inner: { ...existing.inner }, cycle };
    }
    sync.events.length = 0;
    lastRaid.loot = 77;
    expect(sync.paths()).toEqual(["set:lists.0.inner.lastRaid.loot"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a write and a delete after spreads stored by splice emit one event each", () => {
    const sync = fixture();
    for (let cycle = 0; cycle < 3; cycle++) {
      const existing = sync.state.lists[0];
      sync.state.lists.splice(0, 1, { ...existing, inner: { ...existing.inner }, cycle });
    }
    sync.events.length = 0;
    sync.state.lists[0].inner.lastRaid.loot = 5;
    delete sync.state.lists[0].inner.lastRaid;
    expect(sync.paths()).toEqual(["set:lists.0.inner.lastRaid.loot", "delete:lists.0.inner.lastRaid"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a proxy in a Map value and a Set member is stored raw; a Map key stays as it is", () => {
    const events: StateEvent[] = [];
    const donor = reactive({ d: { x: 1 }, k: { id: 1 } });
    const state: any = reactive({ m: new Map(), s: new Set(), x: null as any }, (event) => events.push(event));
    const key = donor.k;
    const d = toRaw(donor).d;
    state.m.set("a", { deep: { p: donor.d } });
    state.s.add({ deep: { p: donor.d } });
    state.x = { m: new Map<any, any>([["k", donor.d], [key, 2]]), s: new Set([{ first: 1 }, donor.d, { last: 1 }]) };
    const raw = toRaw(state);
    expect(raw.m.get("a").deep.p).toBe(d);
    expect([...raw.s][0].deep.p).toBe(d);
    expect(raw.x.m.get("k")).toBe(d);
    // a Map key stays the object it was: the Map finds its entries by it
    expect(raw.x.m.get(key)).toBe(2);
    // the Set keeps its order
    expect([...raw.x.s]).toEqual([{ first: 1 }, d, { last: 1 }]);
    expect([...raw.x.s][1]).toBe(d);
    expect(embeddedProxies(raw.m) + embeddedProxies(raw.s) + embeddedProxies(raw.x.s)).toBe(0);
  });
});

describe("a stored value the store cannot write", () => {
  test("frozen and sealed objects, with and without a proxy inside", () => {
    const donor = reactive({ d: { x: 1 } });
    const state: any = reactive({ cfg: null as any }, () => {});
    expect(() => {
      state.cfg = Object.freeze({ a: { b: 1 } });
    }).not.toThrow();
    expect(Object.isFrozen(toRaw(state).cfg)).toBe(true);
    expect(() => {
      state.cfg = { nested: Object.freeze({ a: { b: 1 } }) };
    }).not.toThrow();
    expect(() => {
      state.cfg = { nested: Object.freeze({ p: donor.d }) };
    }).not.toThrow();
    // the frozen object keeps the proxy; a read returns that same proxy, not a new layer
    expect(state.cfg.nested.p).toBe(donor.d);
    expect(chainDepth(state.cfg.nested.p)).toBe(1);
    expect(() => {
      state.cfg = { nested: Object.seal({ a: { b: 1 }, p: donor.d }) };
    }).not.toThrow();
    // a sealed object's properties stay writable
    expect(isReactive(toRaw(state).cfg.nested.p)).toBe(false);
  });

  test("an own getter without a setter", () => {
    const state: any = reactive({ cfg: null as any }, () => {});
    const holder: any = {};
    Object.defineProperty(holder, "view", { get: () => ({ a: 1 }), enumerable: true });
    expect(() => {
      state.cfg = { holder };
    }).not.toThrow();
    const direct: any = {};
    Object.defineProperty(direct, "view", { get: () => ({ a: 1 }), enumerable: true });
    expect(() => {
      state.cfg = direct;
    }).not.toThrow();
    const donor = reactive({ d: { x: 1 } });
    const proxied: any = {};
    Object.defineProperty(proxied, "view", { get: () => donor.d, enumerable: true });
    expect(() => {
      state.cfg = { proxied };
    }).not.toThrow();
    expect(state.cfg.proxied.view).toBe(donor.d);
  });

  test("fill with a proxy stores its raw object", () => {
    const donor = reactive({ d: { x: 1 } });
    const state: any = reactive({ list: [0, 0] as any[] }, () => {});
    state.list.fill(donor.d);
    expect(isReactive(toRaw(state).list[0])).toBe(false);
    expect(toRaw(state).list[1]).toBe(toRaw(donor).d);
  });
});

describe("a proxy is never wrapped again", () => {
  test("reactive() of a proxy returns that proxy and ignores the second listener", () => {
    const first: StateEvent[] = [];
    const second: StateEvent[] = [];
    const state = reactive({ a: { x: 1 } }, (event) => first.push(event));
    const again = reactive(state, (event) => second.push(event));
    expect(again).toBe(state);
    again.a.x = 2;
    expect(first.length).toBe(2);
    expect(second.length).toBe(0);
  });

  test("a proxy of another root in the initial value emits to its own root", () => {
    const inner: StateEvent[] = [];
    const outer: StateEvent[] = [];
    const innerState = reactive({ x: 1 }, (event) => inner.push(event));
    const outerState = reactive({ child: innerState }, (event) => outer.push(event));
    outerState.child.x = 2;
    expect(chainDepth(outerState.child)).toBe(1);
    expect(outerState.child).toBe(innerState);
    expect(inner.filter((event) => event.action === "set").length).toBe(1);
    expect(outer.filter((event) => event.action === "set").length).toBe(0);
  });
});
