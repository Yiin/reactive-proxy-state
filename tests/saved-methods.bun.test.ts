import { describe, expect, test } from "bun:test";
import { reactive, toRaw, watchEffect } from "../src/index";

/**
 * A method read from a proxy before an effect starts tracks what it reads
 * when it runs inside the effect. Until 3.0.2 readers tracked when they
 * were read, so `const slice = list.slice` taken outside an effect gave a
 * slice that tracked nothing, and so did saved Map and Set iterators.
 */

/** Read a method off the proxy now; run it later. */
type Saved = (collection: any) => () => unknown;

const arrayMethods: Record<string, Saved> = {
  slice: (list) => {
    const slice = list.slice;
    return () => slice();
  },
  map: (list) => {
    const map = list.map;
    return () => map((value: number) => value * 2);
  },
  filter: (list) => {
    const filter = list.filter;
    return () => filter((value: number) => value > 1);
  },
  forEach: (list) => {
    const forEach = list.forEach;
    return () => {
      const seen: number[] = [];
      forEach((value: number) => seen.push(value));
      return seen;
    };
  },
  reduce: (list) => {
    const reduce = list.reduce;
    return () => reduce((sum: number, value: number) => sum + value, 0);
  },
  join: (list) => {
    const join = list.join;
    return () => join("|");
  },
  indexOf: (list) => {
    const indexOf = list.indexOf;
    return () => indexOf(9);
  },
  includes: (list) => {
    const includes = list.includes;
    return () => includes(9);
  },
  find: (list) => {
    const find = list.find;
    return () => find((value: number) => value === 9);
  },
  at: (list) => {
    const at = list.at;
    return () => at(-1);
  },
  concat: (list) => {
    const concat = list.concat;
    return () => concat([0]);
  },
  toSorted: (list) => {
    const toSorted = list.toSorted;
    return () => toSorted();
  },
  with: (list) => {
    const withMethod = list.with;
    return () => withMethod(0, 0);
  },
  keys: (list) => {
    const keys = list.keys;
    return () => [...keys()];
  },
  values: (list) => {
    const values = list.values;
    return () => [...values()];
  },
  entries: (list) => {
    const entries = list.entries;
    return () => [...entries()];
  },
  "Symbol.iterator": (list) => {
    const iterator = list[Symbol.iterator];
    return () => [...iterator.call(list)];
  },
  "an iterator made before the effect": (list) => {
    const iterator = list.values();
    return () => [...iterator];
  },
  toString: (list) => {
    const toString = list.toString;
    return () => toString();
  },
};

const arrayWrites: Record<string, (list: number[]) => unknown> = {
  "index set": (list) => (list[0] = 9),
  push: (list) => list.push(9),
  "shorter length": (list) => (list.length = 1),
  reverse: (list) => list.reverse(),
};

const mapMethods: Record<string, Saved> = {
  get: (map) => {
    const get = map.get;
    return () => get("a");
  },
  has: (map) => {
    const has = map.has;
    return () => has("z");
  },
  values: (map) => {
    const values = map.values;
    return () => [...values()];
  },
  keys: (map) => {
    const keys = map.keys;
    return () => [...keys()];
  },
  entries: (map) => {
    const entries = map.entries;
    return () => [...entries()];
  },
  forEach: (map) => {
    const forEach = map.forEach;
    return () => {
      const seen: unknown[] = [];
      forEach((value: unknown, key: unknown) => seen.push([key, value]));
      return seen;
    };
  },
  "Symbol.iterator": (map) => {
    const iterator = map[Symbol.iterator];
    return () => [...iterator.call(map)];
  },
  "an iterator made before the effect": (map) => {
    const iterator = map.entries();
    return () => [...iterator];
  },
};

const mapWrites: Record<string, (map: Map<string, number>) => unknown> = {
  "set of a held key": (map) => map.set("a", 5),
  "set of a new key": (map) => map.set("z", 9),
  delete: (map) => map.delete("a"),
  clear: (map) => map.clear(),
};

const setMethods: Record<string, Saved> = {
  has: (set) => {
    const has = set.has;
    return () => has(9);
  },
  values: (set) => {
    const values = set.values;
    return () => [...values()];
  },
  keys: (set) => {
    const keys = set.keys;
    return () => [...keys()];
  },
  entries: (set) => {
    const entries = set.entries;
    return () => [...entries()];
  },
  forEach: (set) => {
    const forEach = set.forEach;
    return () => {
      const seen: unknown[] = [];
      forEach((value: unknown) => seen.push(value));
      return seen;
    };
  },
  "Symbol.iterator": (set) => {
    const iterator = set[Symbol.iterator];
    return () => [...iterator.call(set)];
  },
  union: (set) => {
    const union = set.union;
    return () => [...union(new Set([0]))];
  },
  isSubsetOf: (set) => {
    const isSubsetOf = set.isSubsetOf;
    return () => isSubsetOf(new Set([1, 2]));
  },
  "an iterator made before the effect": (set) => {
    const iterator = set.values();
    return () => [...iterator];
  },
};

const setWrites: Record<string, (set: Set<number>) => unknown> = {
  "add of a new value": (set) => set.add(9),
  delete: (set) => set.delete(1),
  clear: (set) => set.clear(),
};

/** Methods that read one entry: the entry they read. The others read every entry. */
const entryReads: Record<string, Record<string, unknown>> = {
  array: {},
  Map: { get: "a", has: "z" },
  Set: { has: 9 },
};

/**
 * Save each method outside an effect, run it inside one, write once, and
 * expect one rerun when the write changed what it read, with the fresh
 * result, else none. The method saved again after the write gives the
 * fresh result.
 */
function savedMatrix(
  kind: string,
  make: () => any,
  methods: Record<string, Saved>,
  writes: Record<string, (collection: any) => unknown>
) {
  describe(`a ${kind} method saved before an effect tracks when it runs`, () => {
    for (const [writeName, write] of Object.entries(writes)) {
      for (const [methodName, save] of Object.entries(methods)) {
        test(`${methodName}, after: ${writeName}`, () => {
          const state = reactive({ collection: make() }, () => {});
          const saved = save(state.collection);
          let seen = "";
          let runs = 0;
          watchEffect(() => {
            runs++;
            seen = JSON.stringify(saved());
          });
          const raw = toRaw(state.collection);
          const entry = Object.hasOwn(entryReads[kind], methodName) ? entryReads[kind][methodName] : undefined;
          const mapKeys = kind === "Map" && methodName === "keys";
          const readDependency = () => mapKeys ? [...raw.keys()]
            : entry === undefined ? undefined
            : methodName === "has" ? raw.has(entry)
            : [raw.has(entry), raw.get?.(entry)];
          const before = JSON.stringify(readDependency());
          write(state.collection);
          const changed = (entry === undefined && !mapKeys) || before !== JSON.stringify(readDependency());
          expect(runs).toBe(changed ? 2 : 1);
          // an iterator made before the effect is used up after the first run
          if (methodName !== "an iterator made before the effect") {
            expect(seen).toBe(JSON.stringify(save(state.collection)()));
          }
        });
      }
    }
  });
}

savedMatrix("array", () => [1, 2, 3], arrayMethods, arrayWrites);
savedMatrix("Map", () => new Map([["a", 1], ["b", 2]]), mapMethods, mapWrites);
savedMatrix("Set", () => new Set([1, 2]), setMethods, setWrites);

describe("reading a method tracks nothing", () => {
  test("an effect that only reads array, Map and Set methods does not rerun after writes", () => {
    const state = reactive({ list: [1], map: new Map([["a", 1]]), set: new Set([1]) }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.list.map;
      state.list.slice;
      state.list.values;
      state.map.values;
      state.map.forEach;
      state.map.get;
      state.set.values;
      state.set.has;
    });
    state.list.push(2);
    state.list[0] = 5;
    state.map.set("b", 2);
    state.map.set("a", 3);
    state.set.add(2);
    expect(runs).toBe(1);
  });

  test("calling a mutator does not make an effect read the length", () => {
    const state = reactive({ log: [] as number[], n: 0 }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      if (state.n > 0) state.log.push(state.n);
    });
    state.n = 1;
    expect(runs).toBe(2);
    state.log.push(7);
    state.log.length = 0;
    expect(runs).toBe(2);
  });

  test("two effects that push to one log do not rerun each other", () => {
    const state = reactive({ log: [] as string[], n: 0 }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.log.push(`a${state.n}`);
    });
    watchEffect(() => {
      runs++;
      state.log.push(`b${state.n}`);
    });
    state.n = 1;
    expect(runs).toBe(4);
    expect([...state.log]).toEqual(["a0", "b0", "a1", "b1"]);
  });
});

describe("an own function on an array", () => {
  test("is called on the raw array, and a later own function in place of a method is the one read", () => {
    const state = reactive({ list: [1, 2, 3] as any }, () => {});
    expect(state.list.map((value: number) => value * 2)).toEqual([2, 4, 6]);
    state.list.map = function (this: number[]) {
      return this.length;
    };
    expect(state.list.map()).toBe(3);
    delete state.list.map;
    expect(state.list.map((value: number) => value + 1)).toEqual([2, 3, 4]);
  });
});
