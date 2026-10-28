import { afterAll, describe, expect, test } from "bun:test";
import { SnapshotLimitError, reactive, toRaw } from "../src/index";
import { replicate } from "./replica";

/**
 * A stored value whose copy finds no known object and no object at two
 * places is fresh: the store skips its place walk. Anything else in a value
 * must still get its places from that walk.
 */

/** `depth + 1` objects, each level holding the one below twice. */
function dag(depth: number): any {
  let value: any = { n: 0 };
  for (let i = 0; i < depth; i++) value = { a: value, b: value };
  return value;
}

describe("values that are not fresh still get their places", () => {
  test("an assigned value that holds a known object", () => {
    const sync = replicate({ list: [{ n: 0 }], x: null as any });
    const item = sync.state.list[0];
    sync.state.x = { inner: { deep: toRaw(item) } };
    sync.clear();
    item.n = 5;
    expect(sync.paths().sort()).toEqual(["set:list.0.n", "set:x.inner.deep.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a map value, a set member and pushed items that hold a known object", () => {
    const sync = replicate({ list: [{ n: 0 }], map: new Map<string, any>(), more: [] as any[] });
    const item = sync.state.list[0];
    sync.state.map.set("a", { inner: [toRaw(item)] });
    sync.state.more.push({ first: 1 }, { inner: toRaw(item) });
    sync.clear();
    item.n = 6;
    expect(sync.paths().sort()).toEqual(["set:list.0.n", "set:map.a.inner.0.n", "set:more.1.inner.n"]);
  });

  test("an alias between two pushed items, below fresh siblings", () => {
    const sync = replicate({ list: [] as any[] });
    const shared = { n: 0 };
    sync.state.list.push({ a: { b: { c: 1 } } }, { x: [shared] }, { y: { z: shared } });
    sync.clear();
    sync.state.list[1].x[0].n = 2;
    expect(sync.paths().sort()).toEqual(["set:list.1.x.0.n", "set:list.2.y.z.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("an alias in a root whose first objects are fresh", () => {
    const shared = { n: 0 };
    const fresh = Array.from({ length: 50 }, (_, i) => ({ i, deep: { i } }));
    const sync = replicate({ fresh, late: { a: shared, b: [shared] } });
    sync.state.late.a.n = 3;
    expect(sync.paths().sort()).toEqual(["set:late.a.n", "set:late.b.0.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a value that holds the object it is written to", () => {
    const events: any[] = [];
    const state: any = reactive({ x: null as any, n: 1 }, (event) => events.push(event));
    events.length = 0;
    state.x = { back: toRaw(state) };
    state.x.back.n = 2;
    expect(events.map((event) => event.path.join("."))).toContain("n");
    expect(toRaw(state).n).toBe(2);
  });

  test("a cycle inside an assigned value keeps both of its places", () => {
    const events: any[] = [];
    const state: any = reactive({ x: null as any }, (event) => events.push(event));
    const value: any = { n: 0, inner: { m: 0 } };
    value.inner.up = value;
    state.x = value;
    events.length = 0;
    // a proxy found through the cycle writes to the object's place under the root
    state.x.inner.up.n = 4;
    expect(events.map((event) => event.path.join("."))).toEqual(["x.n"]);
  });
});

describe("fresh values and the copy limit", () => {
  // these copies are large: free them before the next file measures collection
  afterAll(() => Bun.gc(true));

  test("a fresh root past the measure point is accepted without a measure", () => {
    const raw = { leaves: Array.from({ length: 120_000 }, (_, i) => ({ i })) };
    let events = 0;
    expect(() => reactive(raw, () => events++)).not.toThrow();
    expect(events).toBe(1);
  });

  test("a graph that turns shared after the measure point is still measured", () => {
    const leaves = Array.from({ length: 120_000 }, (_, i) => ({ i }));
    expect(() => reactive({ leaves, graph: dag(17) }, () => {})).toThrow(SnapshotLimitError);
    const state: any = reactive({ x: null }, () => {});
    expect(() => {
      state.x = { leaves: leaves.map((leaf) => ({ ...leaf })), graph: dag(17) };
    }).toThrow(SnapshotLimitError);
    expect(toRaw(state).x).toBeNull();
  });

  test("a shared graph below the limit after many fresh objects is accepted", () => {
    const leaves = Array.from({ length: 120_000 }, (_, i) => ({ i }));
    let events = 0;
    expect(() => reactive({ leaves, graph: dag(15) }, () => events++)).not.toThrow();
    expect(events).toBe(1);
  });
});
