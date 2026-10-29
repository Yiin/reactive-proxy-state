import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";

/**
 * A replica's Set members and Map keys are copies. Each copy carries the
 * identity of the one source member it was made from, so a replica finds
 * its member for an event without comparing contents. A copy that goes back
 * into a source collection is a member of its own there: next to its
 * original it stays a second member in the replica.
 */

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A root and a replica built from its initial replace, fed by its events. */
function mirror<T extends object>(initial: T, async: boolean, onEvent?: (event: StateEvent) => void) {
  let replica: any;
  const state = reactive(
    initial,
    (event) => {
      if (event.action === "replace" && event.path.length === 0) {
        replica = event.newValue;
        return;
      }
      onEvent?.(event);
      updateState(replica, event);
    },
    [],
    async ? { async: true } : undefined
  );
  return { state, replica: () => replica };
}

function members(collection: Set<any>): string[] {
  return [...toRaw(collection)].map((member) => JSON.stringify(toRaw(member)));
}

function entries(map: Map<any, any>): string[] {
  return [...toRaw(map)].map(([key, value]) => JSON.stringify([toRaw(key), value]));
}

for (const async of [false, true]) {
  const mode = async ? "async" : "sync";

  describe(`a copy back in its source collection (${mode})`, () => {
    test("a replica member added to the source Set", async () => {
      const original = { id: 1 };
      const sync = mirror({ s: new Set([original]) }, async);
      await tick();
      const copy = [...sync.replica().s][0];
      sync.state.s.add(copy);
      await tick();
      expect(toRaw(sync.state.s).size).toBe(2);
      expect(members(sync.replica().s)).toEqual(members(sync.state.s));
      sync.state.s.delete(original);
      await tick();
      expect(members(sync.replica().s)).toEqual(members(sync.state.s));
      sync.state.s.delete(copy);
      await tick();
      expect(sync.replica().s.size).toBe(0);
      expect(toRaw(sync.state.s).size).toBe(0);
    });

    test("a set-add payload added as a second member", async () => {
      const original = { id: 1 };
      let kept: any;
      const sync = mirror({ s: new Set() }, async, (event) => {
        if (event.action === "set-add" && kept === undefined) kept = event.value;
      });
      sync.state.s.add(original);
      await tick();
      sync.state.s.add(kept);
      await tick();
      expect(toRaw(sync.state.s).size).toBe(2);
      expect(sync.replica().s.size).toBe(2);
      sync.state.s.delete(original);
      await tick();
      expect(toRaw(sync.state.s).size).toBe(1);
      expect(sync.replica().s.size).toBe(1);
      sync.state.s.delete(kept);
      await tick();
      expect(sync.replica().s.size).toBe(0);
    });

    test("a replica key set in the source Map", async () => {
      const key = { k: 1 };
      const sync = mirror({ m: new Map([[key, "a"]]) }, async);
      await tick();
      const copy = [...sync.replica().m.keys()][0];
      sync.state.m.set(copy, "b");
      await tick();
      expect([...toRaw(sync.state.m).values()]).toEqual(["a", "b"]);
      expect([...sync.replica().m.values()]).toEqual(["a", "b"]);
      sync.state.m.set(key, "c");
      sync.state.m.set(copy, "d");
      await tick();
      expect([...sync.replica().m.values()]).toEqual(["c", "d"]);
      sync.state.m.delete(key);
      await tick();
      expect([...sync.replica().m.values()]).toEqual(["d"]);
      sync.state.m.delete(copy);
      await tick();
      expect(sync.replica().m.size).toBe(0);
    });

    test("members of two replicas of one object added to one third Set", async () => {
      const original = { id: 1 };
      const first = mirror({ s: new Set([original]) }, async);
      const second = mirror({ s: new Set([original]) }, async);
      const third = mirror({ s: new Set() }, async);
      await tick();
      const one = [...first.replica().s][0];
      const two = [...second.replica().s][0];
      third.state.s.add(one);
      third.state.s.add(two);
      await tick();
      expect(toRaw(third.state.s).size).toBe(2);
      expect(third.replica().s.size).toBe(2);
      third.state.s.delete(one);
      await tick();
      expect(third.replica().s.size).toBe(1);
      third.state.s.delete(two);
      await tick();
      expect(third.replica().s.size).toBe(0);
      // the replicas of the first two roots still follow their own source
      first.state.s.delete(original);
      await tick();
      expect(first.replica().s.size).toBe(0);
      expect(second.replica().s.size).toBe(1);
    });

    test("a Map key copy and its original stay two keys after more writes", async () => {
      const key = { k: 1 };
      const sync = mirror({ m: new Map([[key, 1]]) }, async);
      await tick();
      const copy = [...sync.replica().m.keys()][0];
      sync.state.m.set(copy, 2);
      sync.state.m.set(copy, 3);
      sync.state.m.set(key, 4);
      await tick();
      expect(entries(sync.replica().m)).toEqual(entries(sync.state.m));
    });
  });
}

/**
 * A replica finds the member an event names with a lookup, not a scan of the
 * collection. Counted as `WeakMap.prototype.get` calls while the replica
 * applies the events: a few per event, against one per member per event.
 */
describe("a replica's Set and Map updates", () => {
  const COUNT = 4_000;
  const GETS_PER_EVENT = 40;

  function countGets(run: () => void): number {
    const original = WeakMap.prototype.get;
    let gets = 0;
    WeakMap.prototype.get = function (this: WeakMap<object, unknown>, key: object) {
      gets++;
      return original.call(this, key);
    };
    try {
      run();
    } finally {
      WeakMap.prototype.get = original;
    }
    return gets;
  }

  function recorded<T extends object>(initial: T) {
    let replica: any;
    const events: StateEvent[] = [];
    const state = reactive(initial, (event) => {
      if (event.action === "replace" && event.path.length === 0) replica = event.newValue;
      else events.push(event);
    });
    return { state, events, replica: () => replica };
  }

  test("a growing Set, then half of it removed", () => {
    const sync = recorded({ s: new Set<object>() });
    for (let i = 0; i < COUNT; i++) sync.state.s.add({ i });
    const added = [...toRaw(sync.state.s)];
    for (let i = 0; i < COUNT; i += 2) sync.state.s.delete(added[i]);
    const gets = countGets(() => {
      for (const event of sync.events) updateState(sync.replica(), event);
    });
    expect(sync.replica().s.size).toBe(COUNT / 2);
    expect(gets).toBeLessThan(GETS_PER_EVENT * sync.events.length);
  });

  test("Set members and Map keys from the initial copy, all removed", () => {
    const set = new Set<object>();
    const map = new Map<object, number>();
    for (let i = 0; i < COUNT; i++) {
      set.add({ i });
      map.set({ k: i }, i);
    }
    const sync = recorded({ s: set, m: map });
    // last first: a scan from the start would meet every other member first
    for (const member of [...set].reverse()) sync.state.s.delete(member);
    for (const key of [...map.keys()].reverse()) sync.state.m.delete(key);
    const gets = countGets(() => {
      for (const event of sync.events) updateState(sync.replica(), event);
    });
    expect(sync.replica().s.size).toBe(0);
    expect(sync.replica().m.size).toBe(0);
    expect(gets).toBeLessThan(GETS_PER_EVENT * sync.events.length);
  });
});
