import { describe, expect, test } from "bun:test";
import type * as Library from "../src/index";
import type { StateEvent } from "../src/types";

const { reactive, watchEffect, computed, toRaw, updateState } = await import(
  process.env.RPS_TEST_BUNDLE ?? "../src/index"
) as typeof Library;

describe("bounded listener writes", () => {
  for (const alias of [false, true]) {
    test(`a temporary guard terminates and drains committed events, alias=${alias}`, () => {
      const shared = { n: 0 };
      let replica: object = {};
      let busy = false;
      let armed = false;
      let delivered = 0;
      const state = reactive({ a: shared, b: alias ? shared : { n: 0 }, version: 0 }, event => {
        if (event.path.length === 0) { replica = event.newValue; return; }
        updateState(replica, event);
        delivered++;
        if (armed && !busy) {
          busy = true;
          try { state.version++; } finally { busy = false; }
        }
      });
      let effectRuns = 0;
      const stop = watchEffect(() => { state.version; effectRuns++; });
      armed = true;
      if (alias) expect(() => { state.a.n = 1; }).toThrow("100 nested write rounds");
      else state.a.n = 1;
      expect(state.version).toBe(alias ? 100 : 1);
      expect(delivered).toBe(alias ? 102 : 2);
      expect(replica).toEqual(toRaw(state));
      expect(effectRuns).toBe(2);
      armed = false;
      state.a.n = 2;
      expect(replica).toEqual(toRaw(state));
      stop();
    });
  }

  for (const rounds of [99, 100, 101]) {
    test(`a direct chain permits exactly 100 listener-write rounds: ${rounds}`, () => {
      let armed = false;
      const state = reactive({ n: 0 }, event => {
        if (armed && state.n < rounds + 1) state.n++;
      });
      armed = true;
      if (rounds > 100) expect(() => { state.n = 1; }).toThrow(RangeError);
      else state.n = 1;
      expect(state.n).toBe(Math.min(rounds, 100) + 1);
    });
  }

  test("catching a refused write still reports the loop after delivery", () => {
    let armed = false;
    let caught = 0;
    const state = reactive({ n: 0 }, () => {
      if (!armed) return;
      try { state.n++; } catch { caught++; }
    });
    armed = true;
    expect(() => { state.n = 1; }).toThrow("100 nested write rounds");
    expect(caught).toBeGreaterThan(0);
    expect(state.n).toBe(101);
  });

  for (const kind of ["map", "set"] as const) {
    test(`${kind}.clear is refused before mutation at the bound`, () => {
      let armed = false;
      const state = reactive({ n: 0, map: new Map([["a", 1]]), set: new Set([1]) }, () => {
        if (!armed) return;
        if (state.n === 101) state[kind].clear();
        else state.n++;
      });
      armed = true;
      expect(() => { state.n = 1; }).toThrow(RangeError);
      expect(state[kind].size).toBe(1);
    });
  }
});

describe("queued removed payloads", () => {
  for (const op of ["object", "map", "set", "pop", "splice", "reverse"] as const) {
    test(`${op} preserves the removed object before a later held write`, () => {
      const shared = { n: 0 };
      const events: StateEvent[] = [];
      let armed = false;
      const state = reactive({ a: shared, b: shared, child: { n: 0 }, map: new Map([["a", { n: 0 }]]), set: new Set([{ n: 0 }]), list: [{ n: 0 }, { n: 1 }] }, event => {
        if (!armed) return;
        if (event.path.join(".") === "a.n") {
          const held = op === "object" ? state.child : op === "map" ? state.map.get("a")! : op === "set" ? [...state.set][0] : state.list[op === "pop" ? 1 : 0];
          if (op === "object") state.child = { n: 1 };
          else if (op === "map") state.map.delete("a");
          else if (op === "set") state.set.delete(toRaw(held));
          else if (op === "pop") state.list.pop();
          else if (op === "splice") state.list.splice(0, 1);
          else state.list.reverse();
          held.n = 9;
        }
        events.push(event);
      });
      armed = true;
      state.a.n = 1;
      const event = events.find(event => ["child", "map", "set", "list"].includes(String(event.path[0])))!;
      const old = op === "splice" ? event.oldValues![0] : op === "reverse" ? event.oldValue[0] : event.oldValue;
      expect(old.n).toBe(op === "pop" ? 1 : 0);
      if (op === "set") expect(event.value).toBe(event.oldValue);
    });
  }

  test("the after-copy path snapshots a removed value that reaches the mutated container", () => {
    const shared = { n: 0 };
    const list: unknown[] = [];
    const child = { list, n: 0 };
    list.push(child, { n: 1 });
    let old: unknown;
    let armed = false;
    const state = reactive({ a: shared, b: shared, list }, event => {
      if (!armed) return;
      if (event.path.join(".") === "a.n") state.list.reverse();
      if (event.path.join(".") === "list") old = event.oldValue;
    });
    armed = true;
    state.a.n = 1;
    const snapshot = old as typeof list;
    expect((snapshot[0] as typeof child).list[0]).toBe(snapshot[0]);
    expect((snapshot[0] as typeof child).n).toBe(0);
  });
});

describe("listener reads do not belong to the writing effect", () => {
  for (const throws of [false, true]) {
    test(`tracking resumes after a listener, throws=${throws}`, () => {
      let armed = false;
      const tracked: unknown[] = [];
      const state = reactive({ input: 0, output: 0, unrelated: 0, after: 0 }, event => {
        if (!armed || event.path[0] !== "output") return;
        state.unrelated;
        if (throws) throw new Error("listener");
      });
      let runs = 0;
      const stop = watchEffect(() => {
        runs++;
        try { state.output = state.input; } catch {}
        state.after;
      }, { onTrack: event => { tracked.push(event.key); } });
      armed = true;
      state.input = 1;
      expect(runs).toBe(2);
      expect(tracked).not.toContain("unrelated");
      state.unrelated++;
      expect(runs).toBe(2);
      state.after++;
      expect(runs).toBe(3);
      stop();
    });
  }

  test("a computed read in a listener still tracks its own dependencies", () => {
    let armed = false;
    let seen = 0;
    const state = reactive({ input: 0, output: 0, unrelated: 2 }, event => {
      if (armed && event.path[0] === "output") seen = double.value;
    });
    const double = computed(() => state.unrelated * 2);
    let runs = 0;
    const stop = watchEffect(() => { runs++; state.output = state.input; });
    armed = true;
    state.input = 1;
    expect(seen).toBe(4);
    state.unrelated = 3;
    expect(runs).toBe(2);
    state.input = 2;
    expect(seen).toBe(6);
    stop();
    double.stop();
  });
});

test("async branching writes share the bound and recover after the error", async () => {
  const child = Bun.spawn([process.execPath, new URL("./fixtures/async-listener-bound.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  const result = JSON.parse(output);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain("100 nested write rounds");
  expect(result.state).toEqual({ n: 51, other: 200 });
  expect(result.remote).toEqual(result.state);
});

test("initial listener reads stay outside the effect that creates the root", () => {
  const source = reactive({ unrelated: 0 });
  let runs = 0;
  const stop = watchEffect(() => {
    runs++;
    reactive({ value: 0 }, () => { source.unrelated; });
  });
  source.unrelated++;
  expect(runs).toBe(1);
  stop();
});

test("pausing listener tracking preserves the writing effect's self-trigger suppression", () => {
  let armed = false;
  const state = reactive({ n: 0, output: 0 }, event => {
    if (armed && event.path[0] === "output") state.n++;
  });
  let runs = 0;
  const stop = watchEffect(() => { runs++; state.output = state.n; });
  armed = true;
  state.n = 1;
  expect(runs).toBe(2);
  expect(state.n).toBe(2);
  stop();
});

test("separate roots share the listener-write budget", () => {
  let armed = false;
  const first = reactive({ n: 0 }, () => { if (armed) second.n++; });
  const second = reactive({ n: 0 }, () => { if (armed) first.n++; });
  armed = true;
  expect(() => { first.n = 1; }).toThrow("100 nested write rounds");
  expect(first.n + second.n).toBe(101);
});

test("listener writes caused by effects share the caller's budget", () => {
  let armed = false;
  const state = reactive({ a: 0, b: 0, input: 0 }, event => {
    if (armed && event.path[0] === "b") state.input++;
  });
  const stopFirst = watchEffect(() => { state.a = state.input; });
  const stopSecond = watchEffect(() => { state.b = state.a; });
  armed = true;
  expect(() => { state.input = 1; }).toThrow("100 nested write rounds");
  expect(state.input).toBe(101);
  expect(state.a).toBe(101);
  expect(state.b).toBe(101);
  stopFirst();
  stopSecond();
});
