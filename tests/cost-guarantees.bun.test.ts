import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";
import { replicate } from "./replica";

/**
 * What the remaining costs buy, against 1.0.44: an equal assignment compares
 * the values every time (1.0.44 remembered answers that went stale), and the
 * initial replace is a copy (1.0.44 sent the state object itself), so a
 * listener may keep it as its replica.
 */

describe("an equal assignment", () => {
  test("stores a value the caller changed after an earlier equal assignment", () => {
    const events: StateEvent[] = [];
    const state = reactive({ x: { n: 0 } }, (event) => events.push(event));
    const value = { n: 0 };
    state.x = value;
    expect(events.length).toBe(1); // the initial replace only
    value.n = 5;
    state.x = value;
    expect(toRaw(state).x.n).toBe(5);
    expect(events.at(-1)).toMatchObject({ action: "set", path: ["x"], newValue: { n: 5 } });
  });

  test("stores a value equal to what the state held before a write through the proxy", () => {
    const sync = replicate({ x: { n: 0 } });
    const value = { n: 0 };
    sync.state.x = value;
    sync.state.x.n = 7;
    sync.state.x = value;
    expect(toRaw(sync.state).x.n).toBe(0);
    expect(sync.inSync()).toBe(true);
  });
});

describe("the initial replace", () => {
  function first(raw: object, async = false): { state: any; payload: any } {
    let payload: any;
    const state = reactive(
      raw,
      (event) => {
        if (payload === undefined) payload = event.newValue;
      },
      [],
      { async }
    );
    return { state, payload };
  }

  test("is a copy a synchronous listener may keep as its replica", () => {
    const raw = { list: [{ n: 0 }] as any[] };
    let remote: any;
    const state = reactive(raw, (event) => {
      if (remote === undefined) remote = event.newValue;
      else updateState(remote, event);
    });
    expect(remote).not.toBe(raw);
    state.list.push({ n: 1 });
    state.list[0].n = 5;
    // 1.0.44 sent `raw` itself: the push reached the state twice
    expect(toRaw(state)).toEqual({ list: [{ n: 5 }, { n: 1 }] });
    expect(remote).toEqual(toRaw(state));
  });

  test("is a copy with an async listener", async () => {
    const raw = { list: [{ n: 0 }] };
    let payload: any;
    const state = reactive(raw, (event) => (payload ??= event.newValue), [], { async: true });
    state.list.push({ n: 1 });
    await Promise.resolve();
    expect(payload).not.toBe(raw);
    expect(payload).toEqual({ list: [{ n: 0 }] });
  });

  test("is a copy with one object per place when the value holds an alias", () => {
    const shared = { n: 0 };
    const raw = { a: shared, b: shared };
    const { payload } = first(raw);
    expect(payload).not.toBe(raw);
    expect(payload.a).not.toBe(payload.b);
    expect(payload).toEqual({ a: { n: 0 }, b: { n: 0 } });
    // the alias was found: a write through it reaches both places
    const alias = { n: 0 };
    const sync = replicate({ a: alias, b: alias });
    sync.state.a.n = 1;
    expect(sync.paths()).toEqual(["set:a.n", "set:b.n"]);
  });

  test("is a copy of raw objects when the value holds a proxy", () => {
    const other = reactive({ n: 3 }, () => {});
    const raw = { child: other };
    const { payload } = first(raw);
    expect(payload).not.toBe(raw);
    expect(payload.child).toEqual({ n: 3 });
    expect(payload.child).not.toBe(toRaw(other));
  });

  test("is a copy when the value holds a cycle", () => {
    const raw: any = { list: [] };
    raw.list.push(raw);
    const { payload } = first(raw);
    expect(payload).not.toBe(raw);
    expect(payload.list[0]).toBe(payload);
  });
});
