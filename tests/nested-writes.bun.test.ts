import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";
import { copyTree, treeText } from "./replica";

/**
 * A listener can write to the state while it receives an event. That write
 * changed the state after the events still waiting (the other places of an
 * alias), so its events reach the listener after them, and before the write
 * returns. A write made while nothing waits is delivered at once, inside the
 * listener call that made it, as in 1.0.44.
 */

interface Wire {
  state: any;
  remote: any;
  log: string[];
}

/** A root whose listener applies each event, then runs `react` (which may write). */
function wire(raw: object, react: (event: StateEvent, wire: Wire) => void, async = false): Wire {
  const result: Wire = { state: undefined, remote: copyTree(raw), log: [] };
  result.state = reactive(
    raw,
    (event) => {
      if (event.action === "replace" && event.path.length === 0) return;
      const sent = structuredClone(event);
      result.log.push(`${event.action}:${event.path.join(".")}`);
      updateState(result.remote, sent);
      react(event, result);
    },
    [],
    { async }
  );
  return result;
}

// each nested write of an async root flushes on a later microtask
const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

describe("a write made by a listener", () => {
  for (const async of [false, true]) {
    test(`replacing the other place of an alias, async=${async}`, async () => {
      const shared = { n: 0 };
      let nested = false;
      const sync = wire({ a: shared, b: shared }, (_event, { state }) => {
        if (nested) return;
        nested = true;
        state.b = { n: 10 };
      }, async);
      await settle();
      sync.state.a.n = 1;
      await settle();
      expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:b"]);
      expect(toRaw(sync.state)).toEqual({ a: { n: 1 }, b: { n: 10 } });
      expect(sync.remote).toEqual(toRaw(sync.state));
    });

    test(`writing the alias again, async=${async}`, async () => {
      const shared = { n: 0 };
      let nested = false;
      const sync = wire({ a: shared, b: shared }, (_event, { state }) => {
        if (nested) return;
        nested = true;
        state.b.n = 7;
      }, async);
      await settle();
      sync.state.a.n = 1;
      await settle();
      expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:a.n", "set:b.n"]);
      expect(sync.remote).toEqual(toRaw(sync.state));
    });
  }

  test("is delivered before it returns, after the waiting places", () => {
    const shared = { n: 0 };
    const seen: string[][] = [];
    let nested = false;
    const sync = wire({ a: shared, b: shared, c: 0 }, (_event, { state, log }) => {
      if (nested) return;
      nested = true;
      state.c = 1;
      seen.push([...log]);
    });
    sync.state.a.n = 1;
    expect(seen).toEqual([["set:a.n", "set:b.n", "set:c"]]);
    expect(sync.remote).toEqual(toRaw(sync.state));
  });

  test("without an alias is delivered at once, inside the listener call", () => {
    const deliveries: string[] = [];
    let depth = 0;
    let remote: any;
    const state: any = reactive({ x: 0, y: 0 }, (event) => {
      if (event.path.length === 0) {
        remote = structuredClone(event.newValue);
        return;
      }
      depth++;
      deliveries.push(`${event.path.join(".")}@${depth}`);
      updateState(remote, structuredClone(event));
      if (event.path[0] === "x") {
        state.y = 5;
        deliveries.push("y written");
      }
      depth--;
    });
    state.x = 1;
    expect(deliveries).toEqual(["x@1", "y@2", "y written"]);
    expect(remote).toEqual({ x: 1, y: 5 });
  });

  test("between the new indexes of a longer array", () => {
    let nested = false;
    const sync = wire({ list: ["a"] as any[] }, (_event, { state }) => {
      if (nested) return;
      nested = true;
      state.list = ["z"];
    });
    sync.state.list.length = 3;
    expect(sync.log).toEqual(["set:list.1", "set:list.2", "set:list"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
  });

  test("two levels deep, through two aliases", () => {
    const first = { n: 0 };
    const second = { n: 0 };
    const sync = wire({ a: first, b: first, c: second, d: second }, (event, { state }) => {
      if (event.path.join(".") === "a.n" && event.newValue === 1) state.c.n = 2;
      if (event.path.join(".") === "c.n" && event.newValue === 2) state.b = { n: 3 };
    });
    sync.state.a.n = 1;
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c.n", "set:d.n", "set:b"]);
    expect(sync.remote).toEqual(toRaw(sync.state));
  });
});

describe("a listener that throws", () => {
  test("drops the waiting places, and the next write is delivered", () => {
    const shared = { n: 0 };
    let fail = true;
    const sync = wire({ a: shared, b: shared, c: 0 }, () => {
      if (fail) {
        fail = false;
        throw new Error("listener failed");
      }
    });
    expect(() => {
      sync.state.a.n = 1;
    }).toThrow("listener failed");
    expect(sync.log).toEqual(["set:a.n"]);
    sync.state.c = 1;
    sync.state.a.n = 2;
    expect(sync.log).toEqual(["set:a.n", "set:c", "set:a.n", "set:b.n"]);
  });

  test("in a nested write drops what waits, and the caller can go on", () => {
    const shared = { n: 0 };
    let calls = 0;
    const sync = wire({ a: shared, b: shared, c: 0 }, (_event, { state }) => {
      const call = ++calls;
      if (call === 1) {
        expect(() => {
          state.c = 1;
        }).toThrow("second failed");
      }
      if (call === 2) throw new Error("second failed");
    });
    sync.state.a.n = 1;
    // b.n threw while the nested write delivered it; c was dropped with it
    expect(sync.log).toEqual(["set:a.n", "set:b.n"]);
    sync.state.c = 2;
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c"]);
  });
});

/** A small seeded generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One random write through the proxies; aliases come from storing a proxy at a second place. */
function randomWrite(state: any, next: () => number): void {
  const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)];
  const value = Math.floor(next() * 100);
  const objects = (): any[] => {
    const found: any[] = [state.a, state.b, state.m.x];
    for (let i = 0; i < state.list.length; i++) found.push(state.list[i]);
    return found.filter((item) => item !== null && typeof item === "object");
  };
  switch (Math.floor(next() * 9)) {
    case 0:
      pick(objects()).n = value;
      break;
    case 1:
      state[pick(["a", "b"])] = { n: value };
      break;
    case 2:
      state[pick(["a", "b"])] = pick(objects());
      break;
    case 3:
      if (state.list.length < 6) state.list.push(next() < 0.5 ? pick(objects()) : { n: value });
      break;
    case 4:
      if (state.list.length > 0) state.list.splice(Math.floor(next() * state.list.length), 1);
      break;
    case 5:
      if (state.list.length > 0) state.list[Math.floor(next() * state.list.length)] = pick(objects());
      break;
    case 6:
      state.m.x = next() < 0.5 ? pick(objects()) : { n: value };
      break;
    case 7:
      state.list.reverse();
      break;
    default:
      state.c = value;
  }
}

describe("random nested writes keep the replica equal to the state", () => {
  for (const async of [false, true]) {
    test(`300 seeds, async=${async}`, async () => {
      const failures: string[] = [];
      for (let seed = 1; seed <= 300; seed++) {
        const next = random(seed);
        const shared = { n: 0 };
        const other = { n: 1 };
        let depth = 0;
        let nestedWrites = 0;
        const sync = wire(
          { a: shared, b: shared, c: 0, m: { x: other }, list: [shared, other] },
          (_event, { state }) => {
            if (depth >= 2 || nestedWrites >= 40 || next() >= 0.3) return;
            depth++;
            nestedWrites++;
            try {
              randomWrite(state, next);
            } finally {
              depth--;
            }
          },
          async
        );
        await settle();
        for (let step = 0; step < 25; step++) {
          nestedWrites = 0;
          randomWrite(sync.state, next);
          await settle();
          if (treeText(sync.remote) !== treeText(sync.state)) {
            failures.push(`seed ${seed} step ${step}`);
            break;
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }
});
