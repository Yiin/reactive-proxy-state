import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import * as source from "../src/index";
import * as esm from "../dist/index.js";

/**
 * A store puts the raw object where a stored value holds a proxy, through
 * `Reflect.set` on an own data property. A frozen object, a read-only
 * property or a getter keeps the proxy, without an error in either bundle:
 * the ES module bundle runs in strict mode and the CommonJS bundle does not,
 * so a plain assignment threw in one and was ignored in the other. A sealed
 * object's properties stay writable and get the raw object. A proxy that
 * stays in the state stands for its raw object at that place, so a write
 * through it reaches every place of the object.
 */

const cjs = createRequire(import.meta.url)("../dist/index.cjs");
const libraries: [string, typeof source][] = [
  ["src", source],
  ["esm", esm as unknown as typeof source],
  ["cjs", cjs as typeof source],
];

function mirror(lib: typeof source, initial: object) {
  let replica: any;
  const events: source.StateEvent[] = [];
  const state: any = lib.reactive(initial, (event) => {
    if (event.action === "replace" && event.path.length === 0) {
      replica = event.newValue;
      return;
    }
    events.push(event);
    lib.updateState(replica, event);
  });
  const text = (value: any): string =>
    JSON.stringify(value, (_key, item) => (item !== null && typeof item === "object" ? lib.toRaw(item) : item));
  return {
    state,
    events,
    replica: () => replica,
    equal: () => text(replica) === text(state),
    paths: (from: number) => events.slice(from).map((event) => event.path.join(".")),
  };
}

/** What each case does in one library, as text, so the bundles can be compared. */
function storeDirectChild(lib: typeof source): string {
  const results: string[] = [];
  const run = (name: string, make: (sync: ReturnType<typeof mirror>) => object) => {
    const sync = mirror(lib, { a: { x: 1 }, cfg: null });
    try {
      sync.state.cfg = make(sync);
      const before = sync.events.length;
      sync.state.a.x = 2;
      results.push(`${name}: ${sync.paths(before).join(",")} equal=${sync.equal()}`);
    } catch (error) {
      results.push(`${name}: threw ${(error as Error).name}`);
    }
  };
  run("frozen object", (sync) => Object.freeze({ ref: sync.state.a }));
  run("frozen array", (sync) => Object.freeze([sync.state.a]));
  run("read-only property", (sync) => Object.defineProperty({}, "ref", { value: sync.state.a, enumerable: true }));
  run("own getter", (sync) => {
    const holder = {};
    Object.defineProperty(holder, "view", { get: () => sync.state.a, enumerable: true });
    return holder;
  });
  return results.join("\n");
}

describe("a stored object that cannot take the raw object of a proxy it holds", () => {
  test("a direct child: no throw, and every bundle does the same", () => {
    const outcomes = libraries.map(([, lib]) => storeDirectChild(lib));
    expect(outcomes[0]).not.toContain("threw");
    expect(outcomes[1]).toBe(outcomes[0]);
    expect(outcomes[2]).toBe(outcomes[0]);
    expect(outcomes[0]).toBe(
      [
        "frozen object: a.x,cfg.ref.x equal=true",
        "frozen array: a.x,cfg.0.x equal=true",
        "read-only property: a.x,cfg.ref.x equal=true",
        "own getter: a.x,cfg.view.x equal=true",
      ].join("\n")
    );
  });

  for (const [name, lib] of libraries) {
    test(`a frozen object at depth 2, then writes through the kept proxy (${name})`, () => {
      const sync = mirror(lib, { a: { x: 1 }, cfg: null });
      sync.state.cfg = { frozen: Object.freeze({ ref: sync.state.a }) };
      // the frozen object keeps the proxy, the only object it can hold there
      expect(lib.isReactive(lib.toRaw(sync.state).cfg.frozen.ref)).toBe(true);
      let before = sync.events.length;
      sync.state.a.x = 2;
      expect(sync.paths(before)).toEqual(["a.x", "cfg.frozen.ref.x"]);
      expect(sync.equal()).toBe(true);
      before = sync.events.length;
      sync.state.cfg.frozen.ref.x = 3;
      expect(sync.paths(before)).toEqual(["a.x", "cfg.frozen.ref.x"]);
      expect(sync.equal()).toBe(true);
      // the original place is replaced: the kept proxy is the object's only place
      sync.state.a = { x: 9 };
      lib.resetProxyStats();
      before = sync.events.length;
      sync.state.cfg.frozen.ref.x = 4;
      expect(sync.paths(before)).toEqual(["cfg.frozen.ref.x"]);
      expect(lib.getProxyStats().detachedWrites).toBe(0);
      expect(lib.toRaw(sync.state).cfg.frozen.ref.x).toBe(4);
      expect(sync.equal()).toBe(true);
    });

    test(`an own getter at depth 2, then writes through it (${name})`, () => {
      const sync = mirror(lib, { a: { x: 1 }, cfg: null });
      const holder = {};
      const a = sync.state.a;
      Object.defineProperty(holder, "view", { get: () => a, enumerable: true });
      sync.state.cfg = { holder };
      const before = sync.events.length;
      sync.state.cfg.holder.view.x = 5;
      expect(sync.paths(before)).toEqual(["a.x", "cfg.holder.view.x"]);
      expect(sync.equal()).toBe(true);
    });

    test(`a sealed object gets the raw object (${name})`, () => {
      const sync = mirror(lib, { a: { x: 1 }, cfg: null });
      sync.state.cfg = Object.seal({ ref: sync.state.a });
      expect(lib.toRaw(sync.state).cfg.ref).toBe(lib.toRaw(sync.state).a);
      sync.state.cfg = { sealed: Object.seal({ ref: sync.state.a }) };
      expect(lib.toRaw(sync.state).cfg.sealed.ref).toBe(lib.toRaw(sync.state).a);
      const before = sync.events.length;
      sync.state.a.x = 2;
      expect(sync.paths(before)).toEqual(["a.x", "cfg.sealed.ref.x"]);
      expect(sync.equal()).toBe(true);
    });
  }
});
