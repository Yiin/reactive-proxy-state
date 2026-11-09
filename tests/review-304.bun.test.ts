import { describe, expect, test } from "bun:test";
import type * as Library from "../src/index";

const { reactive, watchEffect, toRaw, updateState } = await import(
  process.env.RPS_TEST_BUNDLE ?? "../src/index"
) as typeof Library;

/**
 * A source whose listener writes `version` when it receives an event of
 * `bump`, then forwards the event to a replica, as a sync layer that stamps
 * its own state does.
 */
function stamped<T extends object>(make: () => T, bump: string) {
  const raw = make();
  const remote = structuredClone(raw);
  const sent: string[] = [];
  let armed = false;
  const state = reactive(raw, event => {
    if (!armed) return;
    if (event.path[0] === bump) (state as { version: number }).version++;
    sent.push(`${event.path.join(".")}=${JSON.stringify(event.newValue ?? event.items ?? null)}`);
    updateState(remote, event);
  });
  return { state, remote, sent, arm: () => { armed = true; } };
}

describe("a listener that writes before it forwards", () => {
  test("an effect that writes the same key sends its event after the one that set it off", () => {
    const sync = stamped(() => ({ x: 0, version: 0 }), "x");
    const stop = watchEffect(() => { if (sync.state.x > 10) sync.state.x = 10; });
    sync.arm();
    sync.state.x = 15;
    // 3.0.4 sent version, version, x=10, x=15: the replica ended at 15
    expect(sync.sent).toEqual(["version=1", "x=15", "version=2", "x=10"]);
    expect(sync.remote).toEqual(toRaw(sync.state));
    stop();
  });

  test("an effect that trims the array it read keeps the replica's array", () => {
    const sync = stamped(() => ({ list: [1, 2, 3], version: 0 }), "list");
    const stop = watchEffect(() => {
      if (sync.state.list.length > 3) sync.state.list.splice(0, sync.state.list.length - 3);
    });
    sync.arm();
    sync.state.list.push(4);
    expect(toRaw(sync.state).list).toEqual([2, 3, 4]);
    expect(sync.remote).toEqual(toRaw(sync.state));
    stop();
  });

  test("an effect of the outer write that throws: the listener forwards, then the write throws", () => {
    const sync = stamped(() => ({ x: 0, version: 0 }), "x");
    const stop = watchEffect(() => { if (sync.state.x === 1) throw new Error("effect bug"); });
    sync.arm();
    // 3.0.4 threw out of the listener's own write: the replica kept x: 0
    expect(() => { sync.state.x = 1; }).toThrow("effect bug");
    expect(sync.remote).toEqual({ x: 1, version: 1 });
    expect(sync.remote).toEqual(toRaw(sync.state));
    stop();
  });

  test("an onTrigger hook that throws: the listener forwards, the effect runs, then the write throws", () => {
    const sync = stamped(() => ({ x: 0, version: 0, copy: 0 }), "x");
    const stop = watchEffect(() => { sync.state.copy = sync.state.x; }, {
      onTrigger: () => { throw new Error("hook bug"); },
    });
    sync.arm();
    expect(() => { sync.state.x = 1; }).toThrow("hook bug");
    expect(toRaw(sync.state)).toEqual({ x: 1, version: 1, copy: 1 });
    expect(sync.remote).toEqual(toRaw(sync.state));
    stop();
  });

  test("an effect of the listener's write that writes the key the listener received", () => {
    const sync = stamped(() => ({ x: 0, version: 0 }), "x");
    // 3.0.3 ran it inside the listener: x=20 reached the replica before x=15
    const stop = watchEffect(() => { if (sync.state.version === 1) sync.state.x = 20; });
    sync.arm();
    sync.state.x = 15;
    expect(sync.sent).toEqual(["version=1", "x=15", "version=2", "x=20"]);
    expect(toRaw(sync.state)).toEqual({ x: 20, version: 2 });
    expect(sync.remote).toEqual(toRaw(sync.state));
    stop();
  });

  test("an effect of the listener's write that throws does not stop the listener", () => {
    const sync = stamped(() => ({ x: 0, version: 0 }), "x");
    const stop = watchEffect(() => { if (sync.state.version === 1) throw new Error("effect bug"); });
    sync.arm();
    expect(() => { sync.state.x = 15; }).toThrow("effect bug");
    expect(sync.sent).toEqual(["version=1", "x=15"]);
    expect(sync.remote).toEqual(toRaw(sync.state));
    stop();
  });

  test("the listener sees an effect's result only after the outer write", () => {
    let armed = false;
    const seen: number[] = [];
    const state = reactive({ x: 0, version: 0, double: 0 }, event => {
      if (!armed || event.path[0] !== "x") return;
      state.version++;
      seen.push(state.double);
    });
    const stop = watchEffect(() => { state.double = state.version * 2; });
    armed = true;
    state.x = 1;
    expect(seen).toEqual([0]);
    expect(state.double).toBe(2);
    stop();
  });
});

describe("a write of an inherited value", () => {
  test("an object equal to the inherited one adds the key and sends the event", () => {
    const events: string[] = [];
    const inherited = { k: 1 };
    const state = reactive({ o: Object.create({ obj: inherited, same: inherited }) as Record<string, unknown> }, event => {
      events.push(`${event.action} ${event.path.join(".")}`);
    });
    events.length = 0;
    state.o.obj = { k: 1 };
    state.o.same = inherited;
    expect(events).toEqual(["set o.obj", "set o.same"]);
    expect(Object.keys(toRaw(state.o))).toEqual(["obj", "same"]);
  });

  test("an equal object of an own key is still skipped", () => {
    const events: string[] = [];
    const state = reactive({ o: { obj: { k: 1 } } as Record<string, unknown> }, event => {
      events.push(`${event.action} ${event.path.join(".")}`);
    });
    events.length = 0;
    state.o.obj = { k: 1 };
    expect(events).toEqual([]);
  });
});

describe("Map getOrInsert", () => {
  for (const method of ["getOrInsert", "getOrInsertComputed"] as const) {
    test(`${method} is on the proxy only where the raw map has it`, () => {
      const prototype = Map.prototype as unknown as Record<string, unknown>;
      const native = Object.getOwnPropertyDescriptor(prototype, method);
      try {
        delete prototype[method];
        const state = reactive({ map: new Map([["a", 1]]) });
        expect(typeof (state.map as unknown as Record<string, unknown>)[method]).toBe("undefined");
        expect(method in state.map).toBe(false);
      } finally {
        if (native !== undefined) Object.defineProperty(prototype, method, native);
      }
      if (native === undefined) return;
      const state = reactive({ map: new Map([["a", 1]]) });
      expect(typeof (state.map as unknown as Record<string, unknown>)[method]).toBe("function");
    });
  }
});
