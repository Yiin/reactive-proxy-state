import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import { copyTree, replicate, treeText } from "./replica";

/**
 * One object at several places: a write through it must reach every place,
 * whatever was read before. Places come from the walk that stores a value
 * (root creation, assignment, insertion, array reorders), not from reads.
 */

describe("aliases without a read", () => {
  test("copyWithin over items never read", () => {
    const sync = replicate({ list: [{ v: 0 }, { v: 1 }] });
    sync.state.list.copyWithin(0, 1);
    sync.state.list[0].v = 5;
    expect(sync.paths()).toEqual(["replace:list", "set:list.0.v", "set:list.1.v"]);
    expect(sync.inSync()).toBe(true);
  });

  test("fill with a fresh object", () => {
    const sync = replicate({ list: [{ v: 0 }, { v: 1 }, { v: 2 }] });
    sync.state.list.fill({ v: 7 });
    sync.state.list[0].v = 5;
    expect(sync.paths()).toEqual(["replace:list", "set:list.0.v", "set:list.1.v", "set:list.2.v"]);
    expect(sync.inSync()).toBe(true);
  });

  test("copyWithin then reverse, write through the moved alias", () => {
    const sync = replicate({ list: [{ v: 0 }, { v: 1 }] });
    sync.state.list.copyWithin(0, 1);
    sync.state.list.reverse();
    sync.state.list[1].v = 9;
    expect(sync.inSync()).toBe(true);
  });

  test("sort over an alias made from raw items", () => {
    const item = { v: 3 };
    const sync = replicate({ list: [{ v: 1 }, { v: 2 }] as { v: number }[] });
    toRaw(sync.state.list).push(item, item);
    sync.remote.list.push({ v: 3 }, { v: 3 });
    sync.state.list.sort((left: any, right: any) => right.v - left.v);
    sync.state.list[0].v = 8;
    expect(sync.paths()).toEqual(["replace:list", "set:list.0.v", "set:list.1.v"]);
    expect(sync.inSync()).toBe(true);
  });

  test("an alias in the initial state", () => {
    const item = { n: 0 };
    const sync = replicate({ a: item, b: item });
    sync.state.a.n = 1;
    expect(sync.paths().sort()).toEqual(["set:a.n", "set:b.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("an alias deep in the initial state, written through a child", () => {
    const shared = { deep: { n: 0 } };
    const sync = replicate({ left: { box: shared }, right: [{ box: shared }] });
    sync.state.right[0].box.deep.n = 4;
    expect(sync.paths().sort()).toEqual(["set:left.box.deep.n", "set:right.0.box.deep.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("an alias inside an assigned value", () => {
    const sync = replicate({ x: null as any });
    const shared = { n: 0 };
    sync.state.x = { p: shared, q: [shared] };
    sync.state.x.p.n = 2;
    expect(sync.inSync()).toBe(true);
  });

  test("an alias inside pushed items", () => {
    const sync = replicate({ list: [] as any[] });
    const shared = { n: 0 };
    sync.state.list.push({ a: shared }, { b: shared });
    sync.state.list[1].b.n = 3;
    expect(sync.inSync()).toBe(true);
  });

  test("the same fresh object pushed twice", () => {
    const sync = replicate({ list: [] as any[] });
    const shared = { n: 0 };
    sync.state.list.push(shared, shared);
    sync.state.list[0].n = 3;
    expect(sync.inSync()).toBe(true);
  });
});

/**
 * The first walk of a stored value gives a node to a container that holds
 * a known object. The second walk (for aliases) must still go into that
 * container, or an alias below it loses its place there.
 */
describe("aliases beside a known object", () => {
  test("pushed items: the alias sits in an item that also holds a known object", () => {
    const sync = replicate({ known: { k: 0 }, list: [] as any[] });
    const shared = { n: 0 };
    sync.state.list.push({ known: sync.state.known, x: shared }, { x: shared });
    sync.clear();
    sync.state.list[1].x.n = 1;
    expect(sync.paths().sort()).toEqual(["set:list.0.x.n", "set:list.1.x.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("assigned value: the alias is deep under a container made by the first walk", () => {
    const sync = replicate({ known: { k: 0 }, box: null as any });
    const shared = { n: 0 };
    const known = toRaw(sync.state.known);
    sync.state.box = { left: { inner: { known, deep: { x: shared } } }, right: { x: shared } };
    sync.clear();
    sync.state.box.right.x.n = 2;
    expect(sync.paths().sort()).toEqual(["set:box.left.inner.deep.x.n", "set:box.right.x.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("the alias comes before the known object in the container", () => {
    const sync = replicate({ known: { k: 0 }, list: [] as any[] });
    const shared = { n: 0 };
    sync.state.list.push({ x: shared, known: sync.state.known }, [shared]);
    sync.clear();
    sync.state.list[1][0].n = 3;
    expect(sync.paths().sort()).toEqual(["set:list.0.x.n", "set:list.1.0.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a write through the known object still reaches every place", () => {
    const sync = replicate({ known: { k: 0 }, list: [] as any[] });
    const shared = { n: 0 };
    sync.state.list.push({ known: sync.state.known, x: shared }, { x: shared, known: sync.state.known });
    sync.clear();
    sync.state.known.k = 5;
    sync.state.list[0].x.n = 4;
    expect(sync.paths().sort()).toEqual([
      "set:known.k",
      "set:list.0.known.k",
      "set:list.0.x.n",
      "set:list.1.known.k",
      "set:list.1.x.n",
    ]);
    expect(sync.inSync()).toBe(true);
  });
});

describe("reattached containers get their children's places back", () => {
  test("a parent whose child link was pruned while it was detached", () => {
    const sync = replicate({ a: { n: 0 }, box: null as any, c: null as any });
    const child = sync.state.a;
    sync.state.box = { child };
    const box = sync.state.box;
    void box.child;
    sync.state.box = null;
    sync.state.c = child;
    sync.state.box = box;
    sync.clear();
    child.n = 1;
    expect(sync.paths().sort()).toEqual(["set:a.n", "set:box.child.n", "set:c.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a grandchild link pruned under a detached container", () => {
    const sync = replicate({ a: { n: 0 }, box: null as any, c: null as any });
    const child = sync.state.a;
    sync.state.box = { inner: {} };
    sync.state.box.inner.child = child;
    const box = sync.state.box;
    void box.inner.child;
    sync.state.box = null;
    sync.state.c = child;
    sync.state.box = box;
    sync.clear();
    child.n = 1;
    expect(sync.paths().sort()).toEqual(["set:a.n", "set:box.inner.child.n", "set:c.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("a detached list pushed back into the tree", () => {
    const sync = replicate({ lists: [[{ n: 0 }]] as any[], keep: null as any });
    const list = sync.state.lists[0];
    const item = list[0];
    sync.state.lists.pop();
    sync.state.keep = item;
    sync.state.lists.push(list);
    sync.clear();
    item.n = 2;
    expect(sync.paths().sort()).toEqual(["set:keep.n", "set:lists.0.0.n"]);
    expect(sync.inSync()).toBe(true);
  });
});

/**
 * Random structural changes, aliasing operations and writes through
 * retained proxies, on a fixed set of seeds; the replica must equal the
 * source after every step.
 */
describe("fuzz with aliasing operations", () => {
  function run(seed: number, iterations: number): string | null {
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const below = (count: number) => Math.floor(rand() * count);
    const pick = <T>(values: T[]): T | undefined => (values.length ? values[below(values.length)] : undefined);
    let nextId = 0;
    const fresh = () => ({ id: ++nextId, v: 0, sub: [{ w: 0 }, { w: 1 }], nested: { x: 0, deep: [{ y: 0 }] } });
    const raw: any = {
      a: [fresh(), fresh(), fresh(), fresh()],
      b: [fresh(), fresh()],
      m: new Map([["k1", fresh()], ["k2", fresh()]]),
      o: { p: fresh(), q: fresh() },
      grid: [[fresh(), fresh()], [fresh()]],
    };
    const remote = copyTree(raw);
    let initial = true;
    const state: any = reactive(raw, (event) => {
      if (initial) {
        initial = false;
        return;
      }
      updateState(remote, structuredClone(event));
    });
    const retained: any[] = [];
    const liveArrays = () => {
      const out = [state.a, state.b];
      for (let i = 0; i < state.grid.length; i++) out.push(state.grid[i]);
      return out;
    };
    const anyItem = (): any => {
      const list = pick(liveArrays())!;
      return list.length ? list[below(list.length)] : undefined;
    };
    for (let step = 0; step < iterations; step++) {
      const op = below(24);
      const list = pick(liveArrays())!;
      switch (op) {
        case 0: list.push(fresh()); break;
        case 1: list.unshift(fresh()); break;
        case 2: if (list.length) list.splice(below(list.length), 1 + below(2)); break;
        case 3: list.splice(below(list.length + 1), 0, fresh(), fresh()); break;
        case 4: list.shift(); break;
        case 5: list.pop(); break;
        case 6: list.sort((x: any, y: any) => (x?.v ?? 0) - (y?.v ?? 0) || (y?.id ?? 0) - (x?.id ?? 0)); break;
        case 7: list.reverse(); break;
        case 8: {
          const other = pick(liveArrays())!;
          if (list.length) {
            const [moved] = list.splice(below(list.length), 1);
            other.splice(below(other.length + 1), 0, moved);
          }
          break;
        }
        case 9: { const item = anyItem(); if (item && list.length) list[below(list.length)] = item; break; }
        case 10: if (list.length) list.length = below(list.length); break;
        case 11: {
          const key = below(2) ? "a" : "b";
          state[key] = state[key].filter((_: any, index: number) => index % 2 === 0 || below(2));
          break;
        }
        case 12: {
          const item = anyItem();
          if (item) {
            retained.push(item);
            if (below(2)) retained.push(item.sub, item.nested, item.nested.deep);
          }
          break;
        }
        case 13: case 14: case 15: {
          const proxy = pick(retained);
          if (!proxy) break;
          const target = toRaw(proxy);
          if (Array.isArray(target)) {
            if (target.length && typeof target[0] === "object" && target[0]) {
              if ("y" in target[0]) proxy[0].y++;
              else proxy[below(target.length)].w++;
            } else proxy.push({ w: 9 });
          } else if ("x" in target) proxy.x++;
          else proxy.v++;
          break;
        }
        case 16: { const item = anyItem(); if (item) state.m.set("k" + below(4), item); break; }
        case 17: state.m.delete("k" + below(4)); break;
        case 18: { const item = state.m.get("k" + below(4)); if (item) { item.v++; retained.push(item); } break; }
        case 19: { const item = anyItem(); if (item) state.o[below(2) ? "p" : "q"] = item; break; }
        case 20: {
          const grid = state.grid;
          if (grid.length >= 2) {
            const row = grid[0];
            grid.splice(0, 1);
            grid.push(row);
          } else grid.push([fresh()]);
          break;
        }
        case 21: if (list.length > 1) list.copyWithin(0, 1); break;
        case 22: {
          const proxy = pick(retained);
          if (proxy && !Array.isArray(toRaw(proxy)) && "id" in toRaw(proxy)) list.push(proxy);
          break;
        }
        case 23: { const item = anyItem(); if (item) { item.nested.deep[0].y++; item.sub[0].w++; } break; }
      }
      if (treeText(raw) !== treeText(remote)) return `seed diverged at step ${step} (op ${op})`;
    }
    return null;
  }

  test("200 seeds x 200 steps stay in sync", () => {
    const failures: string[] = [];
    for (let index = 0; index < 200; index++) {
      const seed = 1 + index * 7919;
      const failure = run(seed, 200);
      if (failure !== null) failures.push(`${seed}: ${failure}`);
    }
    expect(failures).toEqual([]);
  });
});

describe("bulk insertion", () => {
  test("pushing many fresh leaves checks for repeats in linear work", () => {
    const sync = replicate({ list: [] as any[] });
    const leaves = Array.from({ length: 400 }, (_, index) => ({ n: index }));
    const nativeIndexOf = Array.prototype.indexOf;
    let scanned = 0;
    Array.prototype.indexOf = function (this: unknown[], search: unknown, from?: number) {
      scanned += this.length - (from ?? 0);
      return nativeIndexOf.call(this, search, from);
    };
    try {
      sync.state.list.push(...leaves);
    } finally {
      Array.prototype.indexOf = nativeIndexOf;
    }
    // a pairwise search reads 79,800 positions for 400 leaves
    expect(scanned).toBeLessThanOrEqual(leaves.length);
    expect(sync.inSync()).toBe(true);
  });

  test("a leaf pushed twice in one batch is still an alias", () => {
    const sync = replicate({ list: [] as any[] });
    const leaves = Array.from({ length: 50 }, (_, index) => ({ n: index }));
    sync.state.list.push(...leaves, leaves[7]);
    sync.clear();
    sync.state.list[50].n = 99;
    expect(sync.paths().sort()).toEqual(["set:list.50.n", "set:list.7.n"]);
    expect(sync.inSync()).toBe(true);
  });
});
