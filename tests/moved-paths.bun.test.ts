import { describe, expect, test } from "bun:test";
import { reactive, updateState, toRaw } from "../src/index";
import type { ReactiveOptions, StateEvent } from "../src/types";

/**
 * Every event a proxy emits must name the place its object holds NOW.
 *
 * Each test keeps two copies: the local raw state behind the proxy and a
 * remote replica that only sees the emitted events (through structuredClone,
 * like a wire). After every step the two must be equal.
 */

type Item = {
  id: string;
  xp: number;
  nested: { value: number };
  children: number[];
  map: Map<string, number>;
  set: Set<number>;
};

const item = (id: string): Item => ({
  id,
  xp: 0,
  nested: { value: 0 },
  children: [],
  map: new Map(),
  set: new Set(),
});

function replicate<T extends object>(raw: T, options?: ReactiveOptions) {
  const remote = structuredClone(raw);
  const events: StateEvent[] = [];
  let initial = true;
  const state = reactive(
    raw,
    (event) => {
      if (initial) {
        initial = false;
        return;
      }
      const wire = structuredClone(event);
      events.push(wire);
      updateState(remote, wire);
    },
    [],
    options
  );
  return {
    state,
    raw,
    remote,
    events,
    paths: () => events.map((event) => `${event.action}:${event.path.join(".")}`),
    clear: () => {
      events.length = 0;
    },
  };
}

const ids = (list: Item[]) => list.map((entry) => entry.id).join(",");

describe("paths after structural array changes (RPS1 matrix)", () => {
  type Mode = "retained" | "lookup-after-warm" | "lookup-after-cold";
  type Case = {
    operate: (root: { list: Item[] }) => void;
    target: string;
    // write paths per mode; [] = the target left the tree and the write must emit nothing
    expected: Record<Mode, string[] | "not-found">;
  };

  const cases: Record<string, Case> = {
    "splice-remove": {
      operate: (root) => root.list.splice(0, 1),
      target: "B",
      expected: { retained: ["list.0.xp"], "lookup-after-warm": ["list.0.xp"], "lookup-after-cold": ["list.0.xp"] },
    },
    "splice-insert": {
      operate: (root) => root.list.splice(0, 0, item("X")),
      target: "B",
      expected: { retained: ["list.2.xp"], "lookup-after-warm": ["list.2.xp"], "lookup-after-cold": ["list.2.xp"] },
    },
    shift: {
      operate: (root) => root.list.shift(),
      target: "B",
      expected: { retained: ["list.0.xp"], "lookup-after-warm": ["list.0.xp"], "lookup-after-cold": ["list.0.xp"] },
    },
    unshift: {
      operate: (root) => root.list.unshift(item("X")),
      target: "B",
      expected: { retained: ["list.2.xp"], "lookup-after-warm": ["list.2.xp"], "lookup-after-cold": ["list.2.xp"] },
    },
    sort: {
      operate: (root) => root.list.sort((left, right) => right.id.localeCompare(left.id)),
      target: "C",
      expected: { retained: ["list.0.xp"], "lookup-after-warm": ["list.0.xp"], "lookup-after-cold": ["list.0.xp"] },
    },
    reverse: {
      operate: (root) => root.list.reverse(),
      target: "C",
      expected: { retained: ["list.0.xp"], "lookup-after-warm": ["list.0.xp"], "lookup-after-cold": ["list.0.xp"] },
    },
    "index-replace-fresh": {
      operate: (root) => {
        root.list[1] = item("X");
      },
      target: "B",
      expected: { retained: [], "lookup-after-warm": "not-found", "lookup-after-cold": "not-found" },
    },
    "index-move-existing": {
      // one object at two places: both remote copies follow every write
      operate: (root) => {
        root.list[0] = root.list[1];
      },
      target: "B",
      expected: {
        retained: ["list.0.xp", "list.1.xp"],
        "lookup-after-warm": ["list.0.xp", "list.1.xp"],
        "lookup-after-cold": ["list.0.xp", "list.1.xp"],
      },
    },
    "length-truncate": {
      operate: (root) => {
        root.list.length = 1;
      },
      target: "B",
      expected: { retained: [], "lookup-after-warm": "not-found", "lookup-after-cold": "not-found" },
    },
    "replace-filter-shared": {
      operate: (root) => {
        root.list = root.list.filter((value) => value.id !== "A");
      },
      target: "B",
      expected: { retained: ["list.0.xp"], "lookup-after-warm": ["list.0.xp"], "lookup-after-cold": ["list.0.xp"] },
    },
    "replace-fresh-items": {
      operate: (root) => {
        root.list = root.list
          .filter((value) => value.id !== "A")
          .map((value) => structuredClone(toRaw(value)));
      },
      target: "B",
      expected: { retained: [], "lookup-after-warm": ["list.0.xp"], "lookup-after-cold": ["list.0.xp"] },
    },
  };

  for (const [name, testCase] of Object.entries(cases)) {
    for (const mode of ["retained", "lookup-after-warm", "lookup-after-cold"] as Mode[]) {
      test(`${name} ${mode}`, () => {
        const sync = replicate({ list: ["A", "B", "C"].map(item) });
        const before =
          mode === "lookup-after-cold"
            ? undefined
            : sync.state.list.find((value) => value.id === testCase.target);
        testCase.operate(sync.state);
        expect(sync.remote).toEqual(sync.raw);
        sync.clear();

        const target =
          mode === "retained" ? before : sync.state.list.find((value) => value.id === testCase.target);
        const expected = testCase.expected[mode];
        if (expected === "not-found") {
          expect(target).toBeUndefined();
          return;
        }
        target!.xp = 12;
        expect(sync.events.map((event) => event.path.join(".")).sort()).toEqual(expected);
        expect(sync.remote).toEqual(sync.raw);
      });
    }
  }

  test("sort and reverse emit one replace event and return the proxy", () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) });
    const list = sync.state.list;
    expect(list.sort((left, right) => right.id.localeCompare(left.id))).toBe(list);
    expect(sync.paths()).toEqual(["replace:list"]);
    expect(ids(sync.remote.list)).toBe("C,B,A");
    // the old order rides along, so a consumer can undo the event
    expect(ids(sync.events[0].oldValue)).toBe("A,B,C");
    sync.clear();
    expect(list.reverse()).toBe(list);
    expect(sync.paths()).toEqual(["replace:list"]);
    expect(ids(sync.remote.list)).toBe("A,B,C");
    sync.clear();
    // an order that does not change emits nothing
    list.sort((left, right) => left.id.localeCompare(right.id));
    expect(sync.events).toEqual([]);
  });

  test("a moved item keeps its proxy", () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) });
    const list = sync.state.list;
    const b = list[1];
    list.splice(0, 1);
    expect(list.find((value) => value.id === "B")).toBe(b);
    list.unshift(item("X"));
    expect(list[1]).toBe(b);
    list.reverse();
    expect(list.at(1)).toBe(b);
    sync.state.list = list.filter((value) => value.id !== "X");
    expect(sync.state.list.find((value) => value.id === "B")).toBe(b);
  });
});

describe("retained proxies on every structural change", () => {
  // Retain a proxy for every item and every nested child, run the operation,
  // then write through all of them. Removed items must stay silent; the
  // replica must match after every write.
  const operations: Record<string, (list: Item[]) => unknown> = {
    "remove first": (list) => list.splice(0, 1),
    "remove middle": (list) => list.splice(2, 1),
    "remove last": (list) => list.splice(4, 1),
    "remove adjacent run": (list) => list.splice(1, 2),
    "remove all": (list) => list.splice(0),
    "remove nothing": (list) => list.splice(9, 1),
    "negative start": (list) => list.splice(-2, 1),
    "replace one with two": (list) => list.splice(1, 1, item("X"), item("Y")),
    "insert at end": (list) => list.splice(5, 0, item("X")),
    pop: (list) => list.pop(),
    shift: (list) => list.shift(),
    unshift: (list) => list.unshift(item("X"), item("Y")),
    push: (list) => list.push(item("X")),
    sort: (list) => list.sort((left, right) => right.id.localeCompare(left.id)),
    reverse: (list) => list.reverse(),
    "copyWithin": (list) => list.copyWithin(0, 3),
    fill: (list) => list.fill(item("X"), 1, 3),
    "length truncate": (list) => {
      list.length = 2;
    },
    "delete index": (list) => {
      delete list[1];
    },
    "index assign": (list) => {
      list[2] = item("X");
    },
  };

  for (const [name, operate] of Object.entries(operations)) {
    test(name, () => {
      const sync = replicate({ list: ["A", "B", "C", "D", "E"].map(item) });
      const retained = sync.state.list.map((_, index) => {
        const entry = sync.state.list[index];
        return {
          entry,
          nested: entry.nested,
          children: entry.children,
          map: entry.map,
          set: entry.set,
        };
      });
      operate(sync.state.list);
      expect(sync.remote).toEqual(sync.raw);

      let value = 100;
      for (const proxies of retained) {
        value++;
        proxies.entry.xp = value;
        proxies.nested.value = value;
        proxies.children.push(value);
        proxies.map.set("k", value);
        proxies.set.add(value);
        expect(sync.remote).toEqual(sync.raw);
      }
    });
  }

  test("removed items and their children emit nothing", () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) });
    const b = sync.state.list[1];
    const children = b.children;
    const map = b.map;
    sync.state.list.splice(1, 1);
    sync.clear();
    b.xp = 1;
    b.nested.value = 1;
    children.push(1);
    map.set("k", 1);
    delete (b as any).id;
    expect(sync.events).toEqual([]);
    expect(sync.remote).toEqual(sync.raw);
  });

  test("a removed item written after reinsertion syncs at its new place", () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) });
    const b = sync.state.list[1];
    const nested = b.nested;
    const [rawB] = sync.state.list.splice(1, 1);
    sync.state.list.push(rawB);
    sync.clear();
    b.xp = 7;
    nested.value = 7;
    expect(sync.paths()).toEqual(["set:list.2.xp", "set:list.2.nested.value"]);
    expect(sync.remote).toEqual(sync.raw);
    expect(sync.state.list[2]).toBe(b);
  });

  test("an item moved by index assignment then delete keeps syncing", () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) });
    const b = sync.state.list[1];
    sync.state.list[0] = b;
    delete sync.state.list[1];
    sync.clear();
    b.xp = 12;
    expect(sync.paths()).toEqual(["set:list.0.xp"]);
    expect(sync.remote).toEqual(sync.raw);
  });

  test("truncate then refill: the removed item cannot write into the new one", () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) });
    const b = sync.state.list[1];
    sync.state.list.length = 1;
    sync.state.list.push(item("X"));
    sync.clear();
    b.xp = 12;
    expect(sync.events).toEqual([]);
    expect(sync.remote).toEqual(sync.raw);
  });

  test("a replaced map value goes silent; a moved one follows", () => {
    const sync = replicate({ byId: new Map([["a", { list: ["A", "B", "C"].map(item) }]]) });
    const group = sync.state.byId.get("a")!;
    const c = group.list[2];
    group.list.splice(0, 1);
    sync.clear();
    c.xp = 3;
    expect(sync.paths()).toEqual(["set:byId.a.list.1.xp"]);
    sync.state.byId.set("a", { list: [item("Z")] });
    sync.clear();
    c.xp = 4;
    group.list.push(item("Q"));
    expect(sync.events).toEqual([]);
    expect(sync.remote).toEqual(sync.raw);
  });
});

describe("deep ancestor moves", () => {
  test("a grandchild follows its ancestor's new index", () => {
    const account = (id: number) => ({
      id,
      villages: [{ id: id * 10, buildings: [{ slot: 1, level: 0 }], queue: new Map<string, number>() }],
    });
    const sync = replicate({ accounts: [account(1), account(2), account(3)] });
    const building = sync.state.accounts[2].villages[0].buildings[0];
    const queue = sync.state.accounts[2].villages[0].queue;
    sync.state.accounts.splice(0, 1);
    sync.state.accounts.unshift(account(9), account(8));
    sync.clear();
    building.level = 5;
    queue.set("x", 1);
    expect(sync.paths()).toEqual([
      "set:accounts.3.villages.0.buildings.0.level",
      "map-set:accounts.3.villages.0.queue",
    ]);
    expect(sync.remote).toEqual(sync.raw);
  });

  test("job history after pruning an earlier job (vangrd jobSanitizer + appendRunHistory)", () => {
    const job = (id: string) => ({ id, kind: "StartFarmList", runHistory: [] as { at: number }[] });
    const sync = replicate({ accounts: { "1": { jobs: [job("orphan"), job("a"), job("b")] } } });
    const jobs = sync.state.accounts["1"].jobs;
    // the prune loop reads every job, which caches every proxy
    for (let index = jobs.length - 1; index >= 0; index--) {
      if (jobs[index].id === "orphan") jobs.splice(index, 1);
    }
    const live = jobs.find((entry) => entry.id === "a")!;
    for (let run = 0; run < 5; run++) {
      live.runHistory.unshift({ at: run });
      if (live.runHistory.length > 3) live.runHistory.length = 3;
    }
    expect(sync.remote).toEqual(sync.raw);
    expect(sync.remote.accounts["1"].jobs[1].runHistory).toEqual([]);
  });

  test("farm-list slot after a reverse prune loop (vangrd mergeFarmLists + findSlot)", () => {
    const list = (id: number) => ({ id, slots: [{ id: id * 100, activeInTravian: true }] });
    const sync = replicate({ farmLists: [list(1), list(2), list(3)] });
    const lists = sync.state.farmLists;
    for (let index = lists.length - 1; index >= 0; index--) {
      if (lists[index].id === 1) lists.splice(index, 1);
    }
    const slot = lists.find((entry) => entry.id === 2)!.slots.find((entry) => entry.id === 200)!;
    slot.activeInTravian = false;
    expect(sync.paths().at(-1)).toBe("set:farmLists.0.slots.0.activeInTravian");
    expect(sync.remote).toEqual(sync.raw);
  });
});

describe("async emission", () => {
  test("each queued event keeps the path it had when it was made", async () => {
    const sync = replicate({ list: ["A", "B", "C"].map(item) }, { async: true });
    await Promise.resolve();
    const b = sync.state.list[1];
    b.xp = 1;
    sync.state.list.splice(0, 1);
    b.xp = 12;
    await Promise.resolve();
    expect(sync.paths()).toEqual(["set:list.1.xp", "array-splice:list", "set:list.0.xp"]);
    expect(sync.remote).toEqual(sync.raw);
  });
});

describe("contract edges", () => {
  test("an object at two places emits one event per place", () => {
    // The wire cannot carry shared identity, so the remote holds two copies.
    // Every write through the shared object updates both.
    const sync = replicate({ a: { settings: { level: 1 } }, b: {} as { settings?: { level: number } } });
    const settings = sync.state.a.settings;
    sync.state.b.settings = settings;
    sync.clear();
    settings.level = 2;
    expect(sync.paths()).toEqual(["set:a.settings.level", "set:b.settings.level"]);
    expect(sync.remote).toEqual(sync.raw);
    // once one place is gone, only the other remains
    delete (sync.state.a as any).settings;
    sync.clear();
    settings.level = 3;
    expect(sync.paths()).toEqual(["set:b.settings.level"]);
    expect(sync.remote).toEqual(sync.raw);
  });

  test("cycles do not hang location lookups", () => {
    const raw: any = { child: { value: 0 } };
    raw.child.back = raw;
    const sync = replicate(raw);
    const child = sync.state.child;
    child.value = 1;
    expect(sync.paths()).toEqual(["set:child.value"]);
    // a detached cycle stays silent
    const loop: any = { name: "loop" };
    loop.self = loop;
    sync.state.child = loop;
    const attached = sync.state.child;
    sync.state.child = { value: 2 };
    sync.clear();
    attached.name = "gone";
    attached.self.name = "still gone";
    expect(sync.events).toEqual([]);
  });

  test("map values() and entries() give each value its own key's path", () => {
    const sync = replicate({ byId: new Map([["a", { n: 0 }], ["b", { n: 0 }]]) });
    for (const value of sync.state.byId.values()) value.n++;
    for (const [, value] of sync.state.byId) value.n++;
    expect(sync.paths()).toEqual(["set:byId.a.n", "set:byId.b.n", "set:byId.a.n", "set:byId.b.n"]);
    expect(sync.remote).toEqual(sync.raw);
  });

  test("an object moved to another root emits there", () => {
    const first: StateEvent[] = [];
    const second: StateEvent[] = [];
    const one = reactive({ item: { n: 0 } } as { item?: { n: number } }, (event) => first.push(event));
    const two = reactive({ items: [] as { n: number }[] }, (event) => second.push(event));
    const item = one.item!;
    two.items.push(item);
    delete one.item;
    first.length = 0;
    second.length = 0;
    item.n = 1;
    expect(first).toEqual([]);
    expect(second.map((event) => event.path.join("."))).toEqual(["items.0.n"]);
  });

  test("no emit function: structural changes still keep identity", () => {
    const state = reactive({ list: ["A", "B", "C"].map(item) });
    const c = state.list[2];
    state.list.splice(0, 1);
    expect(state.list[1]).toBe(c);
  });
});
