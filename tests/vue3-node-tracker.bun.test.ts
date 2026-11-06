import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { createRenderer, effectScope, markRaw, reactive, readonly, ref, shallowReactive, toRaw, watch } from "vue";
import * as secondVueCopy from "@vue/reactivity/dist/reactivity.esm-browser.js";
import { trackVueReactiveEvents, type DiffErrorContext, type StateEvent } from "../src/index";
import { trackVueReactiveEvents as trackVueReactiveEvents200 } from "./fixtures/vue3-tracker-2.0.0";

/**
 * The tracker keeps one Vue effect per object, array, Map and Set. These
 * tests cover what the equivalence fuzz (vue3-equivalence.bun.test.ts) does
 * not: what a write reads, scopes, collection of removed nodes, listener and
 * scan errors, writes made during a scan, stop(), aliases and the Vue copy.
 */

function track(state: object, options: { onDiffError?: (ctx: DiffErrorContext) => void } = {}) {
  const events: StateEvent[] = [];
  const control = trackVueReactiveEvents(state, (event) => events.push(event), { emitInitialReplace: false, ...options });
  return { events, control };
}

const summary = (events: StateEvent[]) => events.map((event) => [event.action, event.path.join("."), event.oldValue, event.newValue]);

/** An object whose `count` getters count every read of its entries. */
function counted(width: number) {
  const counter = { reads: 0 };
  const object: Record<string, number> = {};
  for (let index = 0; index < width; index++) {
    Object.defineProperty(object, `k${index}`, {
      enumerable: true,
      configurable: true,
      get() {
        counter.reads++;
        return index;
      },
    });
  }
  return { counter, object };
}

describe("what a write reads", () => {
  test("writes elsewhere, pause(), resume() and paused writes never read an untouched subtree", () => {
    const { counter, object } = counted(200);
    const state = reactive({ accounts: { quiet: { big: object, list: [object] }, busy: { n: 0, items: [{ x: 1 }] } } });
    const { events, control } = track(state);
    counter.reads = 0;

    state.accounts.busy.n = 1;
    state.accounts.busy.items.push({ x: 2 });
    state.accounts.busy.items[0].x = 5;
    control.pause();
    for (let index = 0; index < 50; index++) state.accounts.busy.n = index;
    state.accounts.busy.items.unshift({ x: 0 });
    (state.accounts as any).added = { deep: { value: 1 } };
    control.resume();
    state.accounts.busy.n = -1;

    expect(counter.reads).toBe(0);
    expect(summary(events)).toEqual([
      ["set", "accounts.busy.n", 0, 1],
      ["set", "accounts.busy.items.1", undefined, { x: 2 }],
      ["set", "accounts.busy.items.0.x", 1, 5],
      ["set", "accounts.busy.n", 49, -1],
    ]);
  });

  test("a write to a parent reads the parent's own entries, not its children's", () => {
    const { counter, object } = counted(100);
    const state = reactive({ parent: { child: object, n: 1 } as Record<string, unknown> });
    const { events } = track(state);
    counter.reads = 0;
    state.parent.n = 2;
    state.parent.other = 3;
    delete state.parent.other;
    expect(counter.reads).toBe(0);
    expect(events.map((event) => event.action)).toEqual(["set", "set", "delete"]);
  });

  test("reads the listener makes never become a node's dependencies", () => {
    const { counter, object } = counted(5);
    (object as Record<string, number>).n = 1;
    const state = reactive({ a: object, b: { x: 1 } });
    const events: StateEvent[] = [];
    trackVueReactiveEvents(
      state,
      (event) => {
        events.push(event);
        void state.b.x;
      },
      { emitInitialReplace: false }
    );
    state.a.n = 2;
    counter.reads = 0;
    // Had node `a` linked to b.x through its listener, this write would re-run it and read its getters.
    state.b.x = 2;
    expect(counter.reads).toBe(0);
    expect(summary(events)).toEqual([
      ["set", "a.n", 1, 2],
      ["set", "b.x", 1, 2],
    ]);
  });
});

describe("scopes", () => {
  test("a node made inside an effect scope keeps tracking after that scope stops", () => {
    const state = reactive({ list: [] as { value: number }[] });
    const { events } = track(state);
    const scope = effectScope();
    scope.run(() => state.list.push({ value: 1 }));
    scope.stop();
    events.length = 0;
    state.list[0].value = 2;
    expect(summary(events)).toEqual([["set", "list.0.value", 1, 2]]);
  });

  test("a node made in a component's setup keeps tracking after the component unmounts", () => {
    const { createApp } = createRenderer<object, object>({
      patchProp() {},
      insert() {},
      remove() {},
      createElement: () => ({}),
      createText: () => ({}),
      createComment: () => ({}),
      setText() {},
      setElementText() {},
      parentNode: () => null,
      nextSibling: () => null,
    });
    const state = reactive({ list: [] as { value: number }[] });
    const { events } = track(state);
    const app = createApp({
      setup() {
        state.list.push({ value: 1 });
        return () => null;
      },
    });
    app.mount({});
    app.unmount();
    events.length = 0;
    state.list[0].value = 2;
    expect(summary(events)).toEqual([["set", "list.0.value", 1, 2]]);
  });

  test("a tracker made inside a scope keeps tracking after that scope stops", () => {
    const state = reactive({ a: { n: 1 } });
    const scope = effectScope();
    const { events } = scope.run(() => track(state))!;
    scope.stop();
    state.a.n = 2;
    expect(summary(events)).toEqual([["set", "a.n", 1, 2]]);
  });
});

async function collectGarbage() {
  for (let round = 0; round < 8; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    Bun.gc(true);
  }
}

/** Bun's collector scans the stack conservatively and keeps a few objects at random; a leak keeps all of them. */
async function aliveAfterCollection(refs: WeakRef<object>[]): Promise<number> {
  let count = refs.length;
  for (let batch = 0; batch < 4 && count > Math.floor(refs.length / 10); batch++) {
    await collectGarbage();
    count = refs.filter((entry) => entry.deref() !== undefined).length;
  }
  return count;
}

describe("removed nodes", () => {
  test("10,000 subtrees added and removed are collected, and a kept one sends nothing", async () => {
    const state = reactive({ slot: null as unknown, paused: null as unknown });
    const { events, control } = track(state);
    const refs: WeakRef<object>[] = [];
    let kept: any = null;
    function churn() {
      for (let round = 0; round < 10_000; round++) {
        const subtree = { a: { b: [{ c: round }, { d: { e: round } }] }, m: new Map([["k", { round }]]) };
        if (round % 50 === 0) refs.push(new WeakRef(subtree), new WeakRef(subtree.a.b[1]));
        state.slot = subtree;
        if (round === 5_000) kept = state.slot;
        if (round % 2 === 0) {
          control.pause();
          state.paused = { list: [subtree.a] };
          control.resume();
        }
      }
      state.slot = null;
      state.paused = null;
    }
    churn();
    events.length = 0;
    kept.a.b[0].c = -1;
    kept.m.get("k").round = -1;
    expect(events).toEqual([]);
    kept = null;
    expect(await aliveAfterCollection(refs)).toBeLessThanOrEqual(Math.floor(refs.length / 10));
  }, 60_000);

  test("an array insert moves the existing child nodes to their new indexes", () => {
    const state = reactive({ list: [{ x: 1 }, { x: 2 }] });
    const { events } = track(state);
    state.list.unshift({ x: 0 });
    events.length = 0;
    state.list[2].x = 20;
    state.list.splice(0, 1);
    events.length = 0;
    state.list[0].x = 10;
    expect(summary(events)).toEqual([["set", "list.0.x", 1, 10]]);
  });
});

describe("errors", () => {
  test("a listener that throws mid-scan is reported, and the scan still finishes (no orphan nodes)", () => {
    const state = reactive({ a: { x: 1 } as Record<string, any> });
    const errors: DiffErrorContext[] = [];
    const events: StateEvent[] = [];
    let throwNext = true;
    trackVueReactiveEvents(
      state,
      (event) => {
        if (throwNext) {
          throwNext = false;
          throw new Error("listener failed");
        }
        events.push(event);
      },
      { emitInitialReplace: false, onDiffError: (context) => errors.push(context) }
    );
    // Two events: the delete of x (throws) and the set of b, whose child node this scan made.
    state.a = { b: { c: 1 }, d: 2 };
    expect(errors.map((context) => [context.key, context.path.join("."), String(context.error)])).toEqual([
      ["a", "a.x", "Error: listener failed"],
    ]);
    expect(summary(events)).toEqual([
      ["set", "a.b", undefined, { c: 1 }],
      ["set", "a.d", undefined, 2],
    ]);
    events.length = 0;
    state.a.b.c = 5;
    state.a.d = 3;
    expect(summary(events)).toEqual([
      ["set", "a.b.c", 1, 5],
      ["set", "a.d", 2, 3],
    ]);
  });

  test("a listener that throws during a Map scan is reported, and the Map stays in step", () => {
    const state = reactive({ m: new Map<string, any>([["a", 1], ["b", 2]]) });
    const errors: DiffErrorContext[] = [];
    const events: StateEvent[] = [];
    let throwNext = true;
    trackVueReactiveEvents(
      state,
      (event) => {
        if (throwNext) {
          throwNext = false;
          throw new Error("listener failed");
        }
        events.push(event);
      },
      { emitInitialReplace: false, onDiffError: (context) => errors.push(context) }
    );
    state.m.clear();
    expect(errors.map((context) => context.path.join("."))).toEqual(["m"]);
    expect(events.map((event) => [event.action, event.key])).toEqual([["map-delete", "b"]]);
    events.length = 0;
    state.m.set("c", 3);
    expect(events.map((event) => [event.action, event.key, event.newValue])).toEqual([["map-set", "c", 3]]);
  });

  /** An object with a getter `g` that throws while `failures.left` is above 0. */
  function flaky() {
    const failures = { left: 0 };
    const object: Record<string, unknown> = { n: 1 };
    Object.defineProperty(object, "g", {
      enumerable: true,
      configurable: true,
      get() {
        if (failures.left > 0) {
          failures.left--;
          throw new Error("getter failed");
        }
        return 7;
      },
    });
    return { failures, object };
  }
  const reported = (errors: DiffErrorContext[]) => errors.map((context) => [context.key, context.path.join("."), String(context.error)]);

  test("an object whose scan throws is rebuilt without events, then reported; the next edit is normal", () => {
    const { failures, object } = flaky();
    const state = reactive({ a: object as any });
    const errors: DiffErrorContext[] = [];
    const { events } = track(state, { onDiffError: (context) => errors.push(context) });
    failures.left = 1;
    state.a.n = 2;
    expect(reported(errors)).toEqual([["a", "a", "Error: getter failed"]]);
    expect(events).toEqual([]);
    state.a.n = 3;
    expect(summary(events)).toEqual([["set", "a.n", 2, 3]]);
  });

  test("a Map whose scan throws is rebuilt through its collection scan", () => {
    const { failures, object } = flaky();
    const state = reactive({ m: new Map<string, any>([["k", object]]) });
    const errors: DiffErrorContext[] = [];
    const { events } = track(state, { onDiffError: (context) => errors.push(context) });
    failures.left = 1;
    state.m.get("k").n = 2;
    expect(reported(errors)).toEqual([["m", "m", "Error: getter failed"]]);
    expect(events).toEqual([]);
    state.m.get("k").n = 3;
    expect(events.map((event) => [event.action, event.key, event.oldValue, event.newValue])).toEqual([
      ["map-set", "k", { n: 2, g: 7 }, { n: 3, g: 7 }],
    ]);
  });

  test("a node whose rebuild throws too comes back on its next run, and its parent sees it again", () => {
    const { failures, object } = flaky();
    const state = reactive({ a: object as any });
    const errors: DiffErrorContext[] = [];
    const { events } = track(state, { onDiffError: (context) => errors.push(context) });
    failures.left = 2;
    state.a.n = 2;
    state.a.n = 3;
    expect(reported(errors)).toEqual([["a", "a", "Error: getter failed"]]);
    expect(events).toEqual([]);
    state.a.n = 4;
    state.a = { n: 9 };
    expect(summary(events)).toEqual([
      ["set", "a.n", 3, 4],
      ["delete", "a.g", 7, undefined],
      ["set", "a.n", 4, 9],
    ]);
  });

  test("a failure in the root object reports key ''", () => {
    let fail = false;
    const root: Record<string, unknown> = { n: 1 };
    Object.defineProperty(root, "g", {
      enumerable: true,
      configurable: true,
      get() {
        if (fail) {
          fail = false;
          throw new Error("root getter failed");
        }
        return 1;
      },
    });
    const state = reactive(root);
    const errors: DiffErrorContext[] = [];
    const { events } = track(state, { onDiffError: (context) => errors.push(context) });
    fail = true;
    state.n = 2;
    expect(errors.map((context) => [context.key, context.path])).toEqual([["", []]]);
    state.n = 3;
    expect(summary(events)).toEqual([["set", "n", 2, 3]]);
  });

  test("a cycle in the state is reported, not followed", () => {
    const a: Record<string, unknown> = { n: 1 };
    a.self = a;
    const errors: DiffErrorContext[] = [];
    track(reactive({ a }), { onDiffError: (context) => errors.push(context) });
    expect(errors.length).toBe(1);
    expect(String(errors[0].error)).toContain("cycle at a.self");
  });
});

describe("writes made during a node's own scan", () => {
  test("a listener write to the scanning node is sent after the scan, and the next edit sends only itself", () => {
    const state = reactive({ a: { x: 1, y: 1, z: 1 } });
    const events: StateEvent[] = [];
    trackVueReactiveEvents(
      state,
      (event) => {
        events.push(event);
        if (event.path.join(".") === "a.x") state.a.y = 2;
      },
      { emitInitialReplace: false }
    );
    state.a.x = 2;
    expect(summary(events)).toEqual([
      ["set", "a.x", 1, 2],
      ["set", "a.y", 1, 2],
    ]);
    events.length = 0;
    state.a.z = 2;
    expect(summary(events)).toEqual([["set", "a.z", 1, 2]]);
  });

  test("a write from a sync watcher the listener sets off is sent too", () => {
    const state = reactive({ a: { x: 1, doubled: 2, other: 0 } });
    const pulse = ref(0);
    watch(pulse, () => (state.a.doubled = state.a.x * 2), { flush: "sync" });
    const events: StateEvent[] = [];
    trackVueReactiveEvents(
      state,
      (event) => {
        events.push(event);
        if (event.path.join(".") === "a.x") pulse.value++;
      },
      { emitInitialReplace: false }
    );
    state.a.x = 5;
    state.a.other = 1;
    expect(summary(events)).toEqual([
      ["set", "a.x", 1, 5],
      ["set", "a.doubled", 2, 10],
      ["set", "a.other", 0, 1],
    ]);
  });
});

describe("stop()", () => {
  let warn: ReturnType<typeof spyOn> | undefined;
  afterEach(() => warn?.mockRestore());

  test("stop() is final: no events after it, and pause() and resume() only warn", () => {
    warn = spyOn(console, "warn").mockImplementation(() => {});
    const state = reactive({ a: { n: 1 } });
    const { events, control } = track(state);
    control.stop();
    state.a.n = 2;
    control.pause();
    control.resume();
    state.a.n = 3;
    control.stop();
    expect(events).toEqual([]);
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining("pause() after stop() does nothing"),
      expect.stringContaining("resume() after stop() does nothing"),
    ]);
  });

  test("pause() and resume() before stop() do not warn", () => {
    warn = spyOn(console, "warn").mockImplementation(() => {});
    const state = reactive({ a: { n: 1 } });
    const { events, control } = track(state);
    control.pause();
    state.a.n = 2;
    control.resume();
    state.a.n = 3;
    expect(summary(events)).toEqual([["set", "a.n", 2, 3]]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("shapes", () => {
  test("one object at two paths sends at both paths", () => {
    const shared = { value: 1 };
    const state = reactive({ left: shared, right: shared });
    const { events } = track(state);
    state.left.value = 2;
    expect(summary(events).sort()).toEqual([
      ["set", "left.value", 1, 2],
      ["set", "right.value", 1, 2],
    ]);
  });

  test("a NaN leaf is sent once, not again on later runs or at resume()", () => {
    const state = reactive({ a: { n: 1, other: 1 } });
    const { events, control } = track(state);
    state.a.n = Number.NaN;
    state.a.other = 2;
    control.pause();
    control.resume();
    state.a.other = 3;
    expect(events.map((event) => event.path.join("."))).toEqual(["a.n", "a.other", "a.other"]);
  });

  test("a Map value that changes type is sent (2.0.0 took an empty Map for {})", () => {
    const state = reactive({ m: new Map<string, unknown>([["k", {}]]) });
    const { events } = track(state);
    state.m.set("k", new Map());
    state.m.set("k", new Set());
    state.m.set("k", new Date(0));
    expect(events.map((event) => Object.prototype.toString.call(event.newValue))).toEqual([
      "[object Map]",
      "[object Set]",
      "[object Date]",
    ]);
  });

  test("Dates, markRaw and frozen objects are compared when their parent runs, with 2.0.0's events", () => {
    const run = (tracker: typeof trackVueReactiveEvents) => {
      const state = reactive({ a: { when: new Date(1000), raw: markRaw({ v: 1 }), frozen: Object.freeze({ v: 1 }), n: 1 } as any });
      const events: StateEvent[] = [];
      tracker(state, (event) => events.push(event), { emitInitialReplace: false });
      toRaw(state.a).when.setTime(2000);
      toRaw(state.a).raw.v = 2;
      state.a.frozen = Object.freeze({ v: 2 });
      state.a.n = 2;
      return summary(events).map((entry) => JSON.stringify(entry)).sort();
    };
    expect(run(trackVueReactiveEvents)).toEqual(run(trackVueReactiveEvents200));
  });

  test("a wide array replaced by a filtered copy sends 2.0.0's events", () => {
    const run = (tracker: typeof trackVueReactiveEvents) => {
      const state = reactive({ x: { ids: Array.from({ length: 2000 }, (_, id) => ({ id, on: id % 3 === 0 })) } });
      const events: StateEvent[] = [];
      tracker(state, (event) => events.push(event), { emitInitialReplace: false });
      state.x.ids = state.x.ids.filter((item) => !item.on);
      state.x.ids[0].on = true;
      return events.map((event) => JSON.stringify(event));
    };
    const events = run(trackVueReactiveEvents);
    expect(events).toEqual(run(trackVueReactiveEvents200));
    expect(events.length).toBeGreaterThan(1000);
  });
});

describe("the Vue copy", () => {
  test("a reactive() object of another @vue/reactivity copy throws at creation, naming the cause", () => {
    const other = secondVueCopy.reactive({ a: 1 });
    expect(() => trackVueReactiveEvents(other, () => {})).toThrow(/two copies of @vue\/reactivity/);
  });

  test("a plain object throws at creation", () => {
    expect(() => trackVueReactiveEvents({ a: 1 }, () => {})).toThrow(/not a reactive\(\) object/);
  });

  test("the app's own reactive(), shallowReactive() and readonly() objects are accepted", () => {
    const state = reactive({ a: { n: 1 } });
    const { events } = track(state);
    state.a.n = 2;
    expect(summary(events)).toEqual([["set", "a.n", 1, 2]]);

    const shallow = shallowReactive({ a: { n: 1 } });
    const shallowTracking = track(shallow);
    shallow.a = { n: 2 };
    expect(summary(shallowTracking.events)).toEqual([["set", "a.n", 1, 2]]);

    expect(() => track(readonly(reactive({ a: 1 })))).not.toThrow();
  });
});
