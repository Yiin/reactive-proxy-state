import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";
import { copyTree, treeText } from "./replica";

/**
 * A listener that throws never loses an event of a write that changed the
 * state: every event still waiting is delivered once, then the first error
 * reaches the write that was delivering them. The replica, which applied
 * each event before the listener threw, stays equal to the state.
 */

interface Wire {
  state: any;
  remote: any;
  log: string[];
}

/** A root whose listener applies each event to a replica, then runs `react` (which may write or throw). */
function wire(raw: object, react: (event: StateEvent, wire: Wire) => void): Wire {
  const result: Wire = { state: undefined, remote: copyTree(raw), log: [] };
  result.state = reactive(raw, (event) => {
    if (event.action === "replace" && event.path.length === 0) return;
    result.log.push(`${event.action}:${event.path.join(".")}`);
    updateState(result.remote, structuredClone(event));
    react(event, result);
  });
  return result;
}

describe("a listener that throws", () => {
  test("on the first place of an alias: the other place is delivered, then the write throws", () => {
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
    expect(sync.log).toEqual(["set:a.n", "set:b.n"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
    sync.state.c = 1;
    sync.state.a.n = 2;
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c", "set:a.n", "set:b.n"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
  });

  test("on every place: each is delivered once, and the first error is thrown", () => {
    const shared = { n: 0 };
    let calls = 0;
    const sync = wire({ a: shared, b: shared, c: shared }, (event) => {
      calls++;
      throw new Error(`failed on ${event.path.join(".")}`);
    });
    expect(() => {
      sync.state.b.n = 1;
    }).toThrow("failed on a.n");
    expect(calls).toBe(3);
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c.n"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
  });

  test("in a nested write: the nested events are delivered, and the caller can go on", () => {
    const shared = { n: 0 };
    let calls = 0;
    let caught = "";
    const sync = wire({ a: shared, b: shared, c: 0 }, (_event, { state }) => {
      const call = ++calls;
      if (call === 1) {
        try {
          state.c = 1;
        } catch (error) {
          caught = (error as Error).message;
        }
      }
      if (call === 2) throw new Error("second failed");
    });
    sync.state.a.n = 1;
    // b.n threw while the nested write delivered it; c was delivered after it
    expect(caught).toBe("second failed");
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
    sync.state.c = 2;
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c", "set:c"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
  });

  test("uncaught in a nested write: the outer write throws after every event", () => {
    const shared = { n: 0 };
    let calls = 0;
    const sync = wire({ a: shared, b: shared, c: 0, d: 0 }, (_event, { state }) => {
      const call = ++calls;
      if (call === 1) state.c = 1;
      if (call === 2) throw new Error("second failed");
      if (call === 3) state.d = 1;
    });
    expect(() => {
      sync.state.a.n = 1;
    }).toThrow("second failed");
    expect(sync.log).toEqual(["set:a.n", "set:b.n", "set:c", "set:d"]);
    expect(treeText(sync.remote)).toBe(treeText(sync.state));
  });

  test("on a write without an alias throws at once, as in 1.0.44", () => {
    const sync = wire({ x: 0 }, () => {
      throw new Error("plain");
    });
    expect(() => {
      sync.state.x = 1;
    }).toThrow("plain");
    expect(toRaw(sync.state).x).toBe(1);
    expect(sync.remote).toEqual({ x: 1 });
  });

  test("on an async root: the rest of the batch is delivered, then the error surfaces", () => {
    const run = Bun.spawnSync([process.execPath, `${import.meta.dir}/fixtures/async-listener-error.ts`]);
    expect(run.exitCode).toBe(0);
    const outcome = JSON.parse(run.stdout.toString());
    expect(outcome.errors).toEqual(["listener failed on x"]);
    expect(outcome.log).toEqual(["x", "y", "z", "y"]);
    expect(outcome.remote).toEqual(outcome.state);
  });
});
