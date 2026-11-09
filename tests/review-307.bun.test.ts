import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type * as Library from "../src/index";
import type { StateEvent } from "../src/types";
// @ts-expect-error shared JavaScript recorder
import { eventText, recordWideWrites } from "./event-stream.ops.mjs";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index") as typeof Library;
const { reactive, watchEffect, ref, computed, triggerRef, toRaw, updateState } = lib;
// The dist/index.js of the npm tarballs, checked against `npm view
// @yiin/reactive-proxy-state@<version> dist.integrity`. Do not edit.
const published306Url = new URL("./fixtures/published-3.0.6.js", import.meta.url);
const published307Url = new URL("./fixtures/published-3.0.7.js", import.meta.url);
const published306 = await import(published306Url.href) as typeof Library;
const published307 = await import(published307Url.href) as typeof Library;

const DEPTH = "nested 101 deep";
const TOTAL = "after 100000 nested rounds";

test("the 3.0.7 bundle is the published one", () => {
  expect(createHash("sha256").update(readFileSync(published307Url)).digest("hex")).toBe(
    "eebd2e860762408e630646ef73de633fa6857763e465b556448aebe2f39c1a17"
  );
});

/** The listener the upgrade guide shows: forward each event, then stamp `version`, except for its own events. */
function stamping<T extends object>(init: T, extra?: (event: StateEvent) => void) {
  let replica: any;
  const events: string[] = [];
  const state: any = reactive({ ...init, version: 0 }, event => {
    if (event.path.length === 0) { replica = event.newValue; return; }
    events.push(eventText(lib, event));
    updateState(replica, event);
    if (event.path[0] === "version") return;
    extra?.(event);
    state.version++;
  });
  return { state, events, replica: () => replica };
}

describe("F1: an operation ends with its outermost batch", () => {
  test("120 ref writes whose effect writes state each get a fresh bound", () => {
    const { state, replica } = stamping({ n: 0, other: 0 });
    const r = ref(0);
    const stop = watchEffect(() => { if (r.value) state.n = r.value; });
    for (let i = 1; i <= 120; i++) r.value = i;
    expect(state.version).toBe(120);
    state.other = 1;
    state.n = 999;
    expect(state.version).toBe(122);
    expect(replica()).toEqual(toRaw(state));
    stop();
  });

  test("writable computed and triggerRef writes end their operation too", () => {
    const { state } = stamping({ n: 0 });
    const r = ref(0);
    const c = computed({ get: () => r.value, set: (value: number) => { r.value = value; } });
    let runs = 0;
    const stop = watchEffect(() => { runs++; if (c.value) state.n = c.value + runs; });
    for (let i = 1; i <= 120; i++) c.value = i;
    for (let i = 0; i < 120; i++) triggerRef(r);
    expect(state.version).toBe(240);
    stop();
  });

  test("a ref write whose flush trips the bound throws once; later writes start fresh", () => {
    let armed = true;
    const state: any = reactive({ n: 0, m: 0, other: 0 }, event => {
      if (armed && event.path.length > 0 && event.path[0] !== "other") state.m++;
    });
    const r = ref(0);
    const stop = watchEffect(() => { if (r.value) state.n = r.value; });
    expect(() => { r.value = 1; }).toThrow(DEPTH);
    // the effect's write is generation 0, then 100 listener generations
    expect(state.m).toBe(100);
    state.other = 1;
    expect(() => { r.value = 2; }).toThrow(DEPTH);
    expect(state.m).toBe(200);
    armed = false;
    r.value = 3;
    expect(state.n).toBe(3);
    stop();
  });

  test("a refused write never leaks its error into a later unrelated write", () => {
    let armed = true;
    const state: any = reactive({ n: 0, other: 0 }, event => {
      if (armed && event.path[0] === "n") state.n++;
    });
    expect(() => { state.n = 1; }).toThrow(DEPTH);
    armed = false;
    expect(() => { state.other = 1; }).not.toThrow();
    armed = true;
    expect(() => { state.other = 2; }).not.toThrow();
    expect(() => { state.n = 0; }).toThrow(DEPTH);
    expect(state.n).toBe(100);
  });
});

describe("F2: finite fan-out above 100 passes, as in 3.0.6", () => {
  test("a length grow, an alias, an effect over items and many effects send 3.0.6's events", async () => {
    const ours: Record<string, string[]> = await recordWideWrites(lib);
    const baseline: Record<string, string[]> = await recordWideWrites(published306);
    expect(Object.keys(ours)).toHaveLength(32);
    expect(ours).toEqual(baseline);
    for (const events of Object.values(ours)) {
      expect(events.at(-1)).toMatch(/^version 15[01], replica equals the source$/);
      expect(events.some(line => line.startsWith("throws") || line.startsWith("logs"))).toBe(false);
    }
  });

  test("the same matrix fails on published 3.0.7", async () => {
    // 3.0.7 throws out of the async microtask, which would fail this test run
    const broken: Record<string, string[]> = await recordWideWrites(published307, [false]);
    const baseline: Record<string, string[]> = await recordWideWrites(published306, [false]);
    expect(Object.keys(baseline)).toHaveLength(16);
    for (const name of Object.keys(baseline)) expect(broken[name]).not.toEqual(baseline[name]);
  });

  test("a listener that forwards an alias write to a reactive replica at 150 places", () => {
    const shared = { n: 0 };
    const mirror = reactive<any>({});
    const { state } = stamping({ list: Array.from({ length: 150 }, () => shared) }, event => updateState(mirror, structuredClone(event)));
    updateState(mirror, { action: "replace", path: [], newValue: structuredClone(toRaw(state)) });
    state.list[0].n = 1;
    expect(state.version).toBe(150);
    expect(toRaw(mirror).list.every((item: { n: number }) => item.n === 1)).toBe(true);
  });
});

describe("branching listener loops stop at the round total", () => {
  test("a queued branching loop throws after 100,000 counted rounds and drains", () => {
    const shared = { n: 0 };
    let armed = false;
    let replica: any;
    let rounds = 0;
    const state: any = reactive({ a: shared, b: shared, x: 0, y: 0 }, event => {
      if (event.path.length === 0) { replica = event.newValue; return; }
      updateState(replica, event);
      if (!armed) return;
      rounds++;
      state.x++;
      state.y++;
    });
    armed = true;
    // the two alias events start a queue, so the loop runs breadth first
    expect(() => { state.a.n = 1; }).toThrow(TOTAL);
    expect(replica).toEqual(toRaw(state));
    // two rounds answer the caller's events; 100,000 more are counted
    expect(state.x).toBe(100_002);
    expect(state.y).toBe(100_002);
    expect(rounds).toBeGreaterThan(100_002);
    armed = false;
    expect(() => { state.a.n = 2; }).not.toThrow();
    expect(replica).toEqual(toRaw(state));
  });

  test("an immediate branching loop nests depth first and stops at the depth", () => {
    let armed = false;
    const state: any = reactive({ x: 0, y: 0 }, () => {
      if (!armed) return;
      state.x++;
      state.y++;
    });
    armed = true;
    expect(() => { state.x = 1; }).toThrow(DEPTH);
    expect(state.x).toBe(101);
    expect(state.y).toBe(0);
  });
});

describe("which error the caller gets", () => {
  test("the bound's RangeError wins over an effect error that came first", () => {
    let armed = false;
    const state: any = reactive({ input: 0, m: 0 }, event => {
      if (armed && event.path[0] === "m") state.m++;
    });
    const first = watchEffect(() => { if (state.input) throw new Error("effect failed"); });
    const second = watchEffect(() => { if (state.input) state.m = state.input; });
    armed = true;
    expect(() => { state.input = 1; }).toThrow(DEPTH);
    expect(state.m).toBe(101);
    armed = false;
    expect(() => { state.input = 2; }).toThrow("effect failed");
    first();
    second();
  });

  test("the bound's RangeError wins over a listener error", () => {
    let armed = false;
    const shared = { n: 0 };
    const state: any = reactive({ a: shared, b: shared, m: 0 }, event => {
      if (!armed) return;
      if (event.path[0] === "a") throw new Error("listener failed");
      state.m++;
    });
    armed = true;
    expect(() => { state.a.n = 1; }).toThrow(DEPTH);
  });
});

describe("F3: removed values of queued events are copies made before the write", () => {
  function cyclic() {
    const raw: any = { box: { x: { tag: "old" } }, a: { n: 0 } };
    raw.box.x.back = raw.box;
    return raw;
  }

  test("an async root and a sync alias queue send the state before the write; an immediate event sends the object", async () => {
    const removed: Record<string, any> = {};
    for (const kind of ["async", "sync queued", "sync immediate"] as const) {
      const raw = cyclic();
      if (kind === "sync queued") raw.alias = raw.box;
      const old = raw.box.x;
      const events: StateEvent[] = [];
      const state: any = reactive(raw, event => { events.push(event); }, [], { async: kind === "async" });
      state.box.x = 5;
      await new Promise(resolve => setTimeout(resolve, 0));
      const event = events.find(event => event.action === "set" && event.path[0] === "box")!;
      removed[kind] = { event, old };
    }
    for (const kind of ["async", "sync queued"]) {
      const { event, old } = removed[kind];
      expect(event.oldValue).not.toBe(old);
      expect(event.oldValue.tag).toBe("old");
      // the copy keeps the cycle as it was: the box still held the old object
      expect(event.oldValue.back.x).toBe(event.oldValue);
    }
    const immediate = removed["sync immediate"];
    expect(immediate.event.oldValue).toBe(immediate.old);
    expect(immediate.event.oldValue.back.x).toBe(5);
  });
});

describe("async roots never throw the bound's error out of the microtask", () => {
  test("bun: a direct chain, an escaping refusal and two roots that write each other are logged", async () => {
    const child = Bun.spawn([process.execPath, new URL("./fixtures/async-bound-no-crash.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe", env: process.env });
    const output = await new Response(child.stdout).text();
    expect(await child.exited).toBe(0);
    const result = JSON.parse(output);
    expect(result.logged).toHaveLength(3);
    for (const message of result.logged) expect(message).toContain(DEPTH);
    expect(result.chain).toBe(101);
    expect(result.pair).toBe(101);
    expect(result.after).toEqual({ n: 5, version: 1 });
  });

  test("an async loop through an effect stops at the depth: the effect's write keeps the listener's generation", async () => {
    const logged: string[] = [];
    const log = console.error;
    console.error = (error: Error) => { logged.push(error.message); };
    let armed = false;
    const state: any = reactive({ a: 0, b: 0 }, event => { if (armed && event.path[0] === "a") state.b++; }, [], { async: true });
    const stop = watchEffect(() => { state.a = state.b + 1; });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      armed = true;
      state.a = 50;
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      console.error = log;
      stop();
    }
    expect(toRaw(state)).toEqual({ a: 101, b: 100 });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(DEPTH);
  });

  test.skipIf(process.env.RPS_TEST_BUNDLE === undefined)("node: the same process exits 0 without an uncaughtException handler", async () => {
    const child = Bun.spawn(["node", new URL("./fixtures/async-bound-no-crash.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe", env: process.env });
    const output = await new Response(child.stdout).text();
    expect(await child.exited).toBe(0);
    const result = JSON.parse(output);
    expect(result.logged).toHaveLength(3);
    expect(result.chain).toBe(101);
  });
});
