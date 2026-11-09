import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState, watchEffect } from "../src/index";
import type { StateEvent } from "../src/types";
import { copyTree, treeText } from "./replica";

/**
 * Effects and listeners together. A listener that throws while it receives
 * the event of a write does not stop the effects of that write: they rerun
 * once, then the write throws. Until 3.0.2 the throw skipped them, and they
 * kept stale values. A listener that writes while it receives an event
 * reruns the effects once per write. Effects stopped, made or cleaned up
 * while a flush runs take part in it as they should.
 */

type Root = { obj: Record<string, number>; list: number[]; map: Map<string, number>; set: Set<number> };

const makeRoot = (): Root => ({
  obj: { a: 1 },
  list: [3, 1, 2],
  map: new Map([["a", 1]]),
  set: new Set([1]),
});

/** A write, and what an effect reads of what it changes. */
const cases: Record<string, { write: (state: Root) => unknown; read: (state: Root) => unknown }> = {
  "object set": { write: (state) => (state.obj.a = 2), read: (state) => state.obj.a },
  "object add": { write: (state) => (state.obj.z = 2), read: (state) => JSON.stringify(state.obj) },
  "object delete": { write: (state) => delete state.obj.a, read: (state) => JSON.stringify(state.obj) },
  "array index set": { write: (state) => (state.list[0] = 9), read: (state) => state.list.join() },
  "array length": { write: (state) => (state.list.length = 1), read: (state) => state.list.join() },
  push: { write: (state) => state.list.push(9), read: (state) => state.list.join() },
  pop: { write: (state) => state.list.pop(), read: (state) => state.list.join() },
  shift: { write: (state) => state.list.shift(), read: (state) => state.list.join() },
  unshift: { write: (state) => state.list.unshift(9), read: (state) => state.list.join() },
  splice: { write: (state) => state.list.splice(1, 1, 7, 8), read: (state) => state.list.join() },
  sort: { write: (state) => state.list.sort(), read: (state) => state.list.join() },
  "map set": { write: (state) => state.map.set("a", 2), read: (state) => state.map.get("a") },
  "map set of a new key": { write: (state) => state.map.set("z", 2), read: (state) => [...state.map.keys()].join() },
  "map delete": { write: (state) => state.map.delete("a"), read: (state) => state.map.has("a") },
  "map clear": { write: (state) => state.map.clear(), read: (state) => state.map.size },
  "set add": { write: (state) => state.set.add(2), read: (state) => [...state.set].join() },
  "set delete": { write: (state) => state.set.delete(1), read: (state) => state.set.has(1) },
  "set clear": { write: (state) => state.set.clear(), read: (state) => state.set.size },
};

/** A root whose listener applies each event to a replica, then runs `react`. */
function wire(react: (event: StateEvent, state: Root) => void, async = false) {
  const remote = copyTree(makeRoot());
  const events: string[] = [];
  const state: Root = reactive(
    makeRoot(),
    (event) => {
      if (event.action === "replace" && event.path.length === 0) return;
      events.push(`${event.action}:${event.path.join(".")}`);
      updateState(remote, structuredClone(event));
      react(event, state);
    },
    [],
    async ? { async: true } : undefined
  );
  return { state, remote, events };
}

describe("a listener that throws while it receives an event", () => {
  for (const [name, { write, read }] of Object.entries(cases)) {
    test(`does not stop the effects of the write: ${name}`, () => {
      let fail = true;
      const sync = wire(() => {
        if (fail) {
          fail = false;
          throw new Error("listener failed");
        }
      });
      const seen: unknown[] = [];
      watchEffect(() => {
        seen.push(read(sync.state));
      });
      expect(() => write(sync.state)).toThrow("listener failed");
      // once, with the value after the write
      expect(seen.length).toBe(2);
      expect(seen[1]).toEqual(read(sync.state));
      expect(treeText(sync.remote)).toBe(treeText(toRaw(sync.state)));
    });
  }

  test("at two places of an alias: every place is delivered, the effects run once, then the write throws", () => {
    const shared = { n: 0 };
    const events: string[] = [];
    let fail = true;
    const state = reactive({ a: shared, b: shared }, (event) => {
      events.push(event.path.join("."));
      if (event.path.length > 0 && fail) {
        fail = false;
        throw new Error("listener failed");
      }
    });
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.a.n;
      state.b.n;
    });
    expect(() => (state.a.n = 1)).toThrow("listener failed");
    expect(events.slice(1)).toEqual(["a.n", "b.n"]);
    expect(runs).toBe(2);
  });

  test("and an effect that throws too: the effects all run, the effect's error is thrown", () => {
    const sync = wire(() => {
      throw new Error("listener failed");
    });
    const ran: string[] = [];
    watchEffect(() => {
      if (sync.state.map.get("a") === 2) throw new Error("effect failed");
      ran.push("first");
    });
    watchEffect(() => {
      sync.state.map.get("a");
      ran.push("second");
    });
    ran.length = 0;
    expect(() => sync.state.map.set("a", 2)).toThrow("effect failed");
    expect(ran).toEqual(["second"]);
  });
});

describe("a listener that writes while it receives an event", () => {
  for (const async of [false, true]) {
    test(`runs the effects after the outermost write, and the replica follows${async ? " (async root)" : ""}`, async () => {
      let nested = true;
      const sync = wire((event, state) => {
        if (nested && event.action === "map-set") {
          nested = false;
          state.map.set("b", 2);
          state.set.add(5);
          state.list.push(4);
        }
      }, async);
      const seen: string[] = [];
      watchEffect(() => {
        seen.push(`${[...sync.state.map.keys()]}|${[...sync.state.set]}|${sync.state.list.length}`);
      });
      sync.state.map.set("a", 2);
      if (async) await Promise.resolve();
      // The listener's writes are nested in the write it receives: the effect
      // runs once, when that write ends. An async root delivers after the
      // write, so each write the listener makes runs the effect. Updating
      // a held Map value does not rerun this keys-only reader.
      expect(seen).toEqual(
        async ? ["a|1|3", "a,b|1|3", "a,b|1,5|3", "a,b|1,5|4"] : ["a|1|3", "a,b|1,5|4"]
      );
      expect(sync.events).toEqual(["map-set:map", "map-set:map", "set-add:set", "array-push:list"]);
      expect(treeText(sync.remote)).toBe(treeText(toRaw(sync.state)));
    });
  }
});

describe("effects that change while a flush runs", () => {
  const writes: Record<string, (state: Root) => unknown> = {
    "a Map write": (state) => state.map.set("a", 5),
    "a Set write": (state) => state.set.add(5),
    "an array write": (state) => state.list.push(5),
  };
  const reads = (state: Root) => [state.map.get("a"), [...state.set], state.list.length];

  for (const [name, write] of Object.entries(writes)) {
    test(`an effect stopped by an earlier effect of the flush does not run: ${name}`, () => {
      const state = reactive(makeRoot(), () => {});
      let stopLater = () => {};
      watchEffect(() => {
        reads(state);
        if (state.map.get("a") === 5 || state.set.has(5) || state.list.length === 4) stopLater();
      });
      let later = 0;
      stopLater = watchEffect(() => {
        later++;
        reads(state);
      });
      write(state);
      expect(later).toBe(1);
    });

    test(`an effect made during the flush runs once for that write, and again for the next: ${name}`, () => {
      const state = reactive(makeRoot(), () => {});
      let made = 0;
      let started = false;
      watchEffect(() => {
        reads(state);
        if (!started && (state.map.get("a") === 5 || state.set.has(5) || state.list.length === 4)) {
          started = true;
          watchEffect(() => {
            made++;
            reads(state);
          });
        }
      });
      write(state);
      expect(made).toBe(1);
      state.map.set("a", 6);
      expect(made).toBe(2);
    });

    test(`an effect that stops itself and subscribes again runs once per write: ${name}`, () => {
      const state = reactive(makeRoot(), () => {});
      let runs = 0;
      let stop = () => {};
      const subscribe = () => {
        stop = watchEffect(() => {
          runs++;
          const values = reads(state);
          if (runs === 2) {
            stop();
            subscribe();
          }
          return values;
        });
      };
      subscribe();
      write(state);
      // run 2 stopped itself, and the new effect ran once
      expect(runs).toBe(3);
      state.map.set("a", 7);
      expect(runs).toBe(4);
    });

    test(`a cleanup runs once before each rerun, also when it writes: ${name}`, () => {
      const state = reactive({ ...makeRoot(), cleanups: 0 }, () => {});
      const order: string[] = [];
      watchEffect((onCleanup) => {
        reads(state);
        order.push("run");
        onCleanup(() => {
          order.push("cleanup");
          state.cleanups++;
        });
      });
      let watcher = 0;
      watchEffect(() => {
        watcher++;
        state.cleanups;
      });
      write(state);
      expect(order).toEqual(["run", "cleanup", "run"]);
      expect(watcher).toBe(2);
    });
  }
});
