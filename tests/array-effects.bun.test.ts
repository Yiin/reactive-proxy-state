import { describe, expect, test } from "bun:test";
import { computed, reactive, watch, watchEffect } from "../src/index";

/**
 * An effect that reads an array reruns after every write that changes what
 * it read, once per write. 3.0.1 and earlier missed most of them
 * (vangrd-48ocs): an index set or delete and a length change triggered
 * only that key, so `map`, `filter`, `indexOf`, `includes` and the other
 * readers of all items never reran; `slice`, `concat`, `flat`, `flatMap`,
 * `findLastIndex`, `toSorted`, `toSpliced`, `with` and `toString`
 * tracked nothing; a write past the end did not trigger `length`; a
 * shorter length did not trigger the indexes it removed; the array methods
 * did not trigger the indexes they moved; and an effect that read both the
 * items and the length ran twice per method call.
 */

type Item = { id: number };

/** What a reader may compare against: raw items of the state, from outside the effect. */
type Probe = { first: Item; nine: Item };

const ids = (items: readonly (Item | undefined)[]) => items.map((item) => item?.id ?? null);
const byId = (a: Item | undefined, b: Item | undefined) => (a?.id ?? 0) - (b?.id ?? 0);

/** Every way an effect can read the array as a whole, and index reads. */
const readers: Record<string, (list: Item[], probe: Probe) => unknown> = {
  map: (list) => list.map((item) => item?.id),
  filter: (list) => ids(list.filter((item) => item.id !== 2)),
  forEach: (list) => {
    const seen: number[] = [];
    list.forEach((item) => seen.push(item.id));
    return seen;
  },
  some: (list) => [list.some((item) => item.id === 9), list.some((item) => item.id === 1)],
  every: (list) => [list.every((item) => item.id < 9), list.every((item) => item.id > 1)],
  reduce: (list) => list.reduce((sum, item) => sum + item.id, 0),
  reduceRight: (list) => list.reduceRight((order, item) => order + item.id, ""),
  join: (list) => list.join("|"),
  toString: (list) => [String(list), `${list}`, list.toString(), list.toLocaleString()],
  indexOf: (list, probe) => [list.indexOf(probe.first), list.indexOf(probe.nine)],
  lastIndexOf: (list, probe) => [list.lastIndexOf(probe.first), list.lastIndexOf(probe.nine)],
  includes: (list, probe) => [list.includes(probe.first), list.includes(probe.nine)],
  find: (list) => [list.find((item) => item.id === 9)?.id, list.find((item) => item.id !== 0)?.id],
  findIndex: (list) => [list.findIndex((item) => item?.id === 9), list.findIndex((item) => item?.id === 1)],
  findLast: (list) => [list.findLast((item) => item.id === 9)?.id, list.findLast((item) => item.id !== 0)?.id],
  findLastIndex: (list) => [list.findLastIndex((item) => item?.id === 9), list.findLastIndex((item) => item?.id === 1)],
  flat: (list) => ids(list.flat()),
  flatMap: (list) => list.flatMap((item) => [item.id]),
  slice: (list) => ids(list.slice()),
  concat: (list) => ids(list.concat([])),
  toReversed: (list) => ids(list.toReversed()),
  toSorted: (list) => ids(list.toSorted(byId)),
  toSpliced: (list) => ids(list.toSpliced(0, 1)),
  with: (list) => ids(list.with(-1, { id: 0 })),
  "keys()": (list) => [...list.keys()],
  "values()": (list) => ids([...list.values()]),
  "entries()": (list) => [...list.entries()].map(([index, item]) => [index, item?.id ?? null]),
  "for...of": (list) => {
    const seen: (number | null)[] = [];
    for (const item of list) seen.push(item?.id ?? null);
    return seen;
  },
  spread: (list) => ids([...list]),
  "Array.from": (list) => ids(Array.from(list)),
  at: (list) => [list.at(0)?.id, list.at(-1)?.id],
  "Object.keys": (list) => Object.keys(list),
  "Object.entries": (list) => Object.entries(list).map(([key, item]) => [key, item.id]),
  "for...in": (list) => {
    const keys: string[] = [];
    for (const key in list) keys.push(key);
    return keys;
  },
  in: (list) => [0 in list, 1 in list, 2 in list, 3 in list],
  hasOwnProperty: (list) => [list.hasOwnProperty(0), list.hasOwnProperty(3)],
  length: (list) => list.length,
  "index reads": (list) => [list[0]?.id, list[2]?.id, list[3]?.id],
  "JSON.stringify": (list) => JSON.stringify(list),
};

/** Every kind of write to an array: of an index, of the length, and by a method. */
const writes: Record<string, (list: Item[], nine: Item) => unknown> = {
  "index set": (list, nine) => (list[0] = nine),
  "index set past the end": (list, nine) => (list[3] = nine),
  "index set far past the end": (list, nine) => (list[5] = nine),
  "index delete": (list) => delete list[0],
  "last index delete": (list) => delete list[2],
  "shorter length": (list) => (list.length = 1),
  "length 0": (list) => (list.length = 0),
  "longer length": (list) => (list.length = 5),
  push: (list, nine) => list.push(nine),
  pop: (list) => list.pop(),
  shift: (list) => list.shift(),
  unshift: (list, nine) => list.unshift(nine),
  "splice removes": (list) => list.splice(0, 1),
  "splice inserts": (list, nine) => list.splice(1, 0, nine),
  "splice replaces": (list, nine) => list.splice(1, 1, nine),
  reverse: (list) => list.reverse(),
  sort: (list) => list.sort((a, b) => b.id - a.id),
  fill: (list, nine) => list.fill(nine, 0, 1),
  copyWithin: (list) => list.copyWithin(0, 1),
};

/** Where the array sits in the state. */
const placements: Record<string, (items: Item[]) => () => Item[]> = {
  "in an object": (items) => {
    const state = reactive({ list: items }, () => {});
    return () => state.list;
  },
  "in an array (nested)": (items) => {
    const state = reactive({ lists: [[{ id: 7 }], items] }, () => {});
    return () => state.lists[1];
  },
  "in an object in an array": (items) => {
    const state = reactive({ groups: [{ name: "a" }, { list: items }] as { list?: Item[] }[] }, () => {});
    return () => state.groups[1].list!;
  },
  "as the root": (items) => {
    const state = reactive(items, () => {});
    return () => state;
  },
};

function show(read: () => unknown): string {
  try {
    return JSON.stringify(read()) ?? "undefined";
  } catch (error) {
    return `throws ${(error as Error).name}`;
  }
}

describe("an effect over an array reruns once after each write that changes what it read", () => {
  for (const [writeName, write] of Object.entries(writes)) {
    describe(writeName, () => {
      for (const [readerName, read] of Object.entries(readers)) {
        test(readerName, () => {
          for (const [placementName, place] of Object.entries(placements)) {
            const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const probe = { first: items[0], nine: { id: 9 } };
            const list = place(items);
            let seen = "";
            let runs = 0;
            const stop = watchEffect(() => {
              runs++;
              seen = show(() => read(list(), probe));
            });
            const initial = seen;
            write(list(), probe.nine);
            stop();
            const fresh = show(() => read(list(), probe));
            expect({ placement: placementName, seen }).toEqual({ placement: placementName, seen: fresh });
            // a reader of a value that did not change may rerun, never twice
            const reruns = runs - 1;
            const expected = fresh === initial ? Math.min(reruns, 1) : 1;
            expect({ placement: placementName, reruns }).toEqual({ placement: placementName, reruns: expected });
          }
        });
      }
    });
  }
});

describe("the reported case", () => {
  test("map reruns after an index set and an index delete", () => {
    const state = reactive({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] }, () => {});
    let seen: (number | undefined)[] = [];
    watchEffect(() => {
      seen = state.list.map((item) => item?.id);
    });
    state.list[0] = { id: 9 };
    expect(seen).toEqual([9, 2, 3]);
    delete state.list[1];
    expect(seen).toEqual([9, undefined, 3]);
  });

  test("filter reruns after a length change", () => {
    const state = reactive({ list: [1, 2, 3, 4] }, () => {});
    let even: number[] = [];
    watchEffect(() => {
      even = state.list.filter((value) => value % 2 === 0);
    });
    state.list.length = 3;
    expect(even).toEqual([2]);
  });
});

describe("an effect that reads indexes, the length and all items", () => {
  for (const [writeName, write] of Object.entries(writes)) {
    test(`runs once after: ${writeName}`, () => {
      const state = reactive({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.list[0];
        state.list[1];
        state.list.length;
        state.list.map((item) => item?.id);
        for (const item of state.list) item;
        state.list.indexOf(state.list[2]);
      });
      write(state.list, { id: 9 });
      expect(runs).toBe(2);
    });
  }
});

describe("an effect reruns only for what it read", () => {
  const unchangedFirst: Record<string, (list: Item[]) => unknown> = {
    push: (list) => list.push({ id: 9 }),
    pop: (list) => list.pop(),
    "set of another index": (list) => (list[2] = { id: 9 }),
    "set past the end": (list) => (list[3] = { id: 9 }),
    "longer length": (list) => (list.length = 5),
    "shorter length": (list) => (list.length = 2),
    "delete of another index": (list) => delete list[1],
    "splice after it": (list) => list.splice(1, 1),
    "fill after it": (list) => list.fill({ id: 9 }, 1),
    "copyWithin after it": (list) => list.copyWithin(1, 2),
    "sort that keeps it in place": (list) => list.sort((a, b) => (a.id === 1 ? -1 : b.id === 1 ? 1 : b.id - a.id)),
  };
  for (const [name, write] of Object.entries(unchangedFirst)) {
    test(`an index read does not rerun after: ${name}`, () => {
      const state = reactive({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.list[0];
      });
      write(state.list);
      expect(runs).toBe(1);
    });
  }

  const sameLength: Record<string, (list: Item[]) => unknown> = {
    "index set": (list) => (list[0] = { id: 9 }),
    "index delete": (list) => delete list[0],
    reverse: (list) => list.reverse(),
    "splice replaces": (list) => list.splice(0, 1, { id: 9 }),
  };
  for (const [name, write] of Object.entries(sameLength)) {
    test(`a length read does not rerun after: ${name}`, () => {
      const state = reactive({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.list.length;
      });
      write(state.list);
      expect(runs).toBe(1);
    });
  }

  test("a write of a named property of an array does not rerun a reader of its items", () => {
    const state = reactive({ list: [1, 2, 3] as number[] & { label?: string } }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.list.map((value) => value);
    });
    state.list.label = "x";
    expect(runs).toBe(1);
  });
});

describe("a reader of an index the write removed", () => {
  const removals: Record<string, (list: Item[]) => unknown> = {
    "shorter length": (list) => (list.length = 1),
    pop: (list) => list.pop(),
    shift: (list) => list.shift(),
    "splice removes": (list) => list.splice(0, 1),
  };
  for (const [name, write] of Object.entries(removals)) {
    test(`reruns after: ${name}`, () => {
      const state = reactive({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] }, () => {});
      let last: number | undefined = 0;
      watchEffect(() => {
        last = state.list[2]?.id;
      });
      write(state.list);
      expect(last).toBeUndefined();
    });
  }
});

describe("computed and watch over array readers", () => {
  test("a computed map follows index writes and length changes", () => {
    const state = reactive({ list: [{ id: 1 }, { id: 2 }] }, () => {});
    const listIds = computed(() => state.list.map((item) => item?.id ?? null));
    expect(listIds.value).toEqual([1, 2]);
    state.list[1] = { id: 5 };
    expect(listIds.value).toEqual([1, 5]);
    state.list[2] = { id: 6 };
    expect(listIds.value).toEqual([1, 5, 6]);
    delete state.list[0];
    expect(JSON.stringify(listIds.value)).toBe("[null,5,6]"); // map keeps the hole
    state.list.length = 1;
    expect(JSON.stringify(listIds.value)).toBe("[null]");
  });

  test("a watch of slice fires once per write", () => {
    const state = reactive({ list: [1, 2, 3] }, () => {});
    const calls: number[][] = [];
    watch(
      () => state.list.slice(),
      (value) => calls.push(value)
    );
    state.list[0] = 7;
    state.list.splice(1, 1);
    state.list.length = 0;
    expect(calls).toEqual([[7, 2, 3], [7, 3], []]);
  });

  test("a deep watch of an array fires for a write past its end", () => {
    const state = reactive({ list: [{ id: 1 }] as Item[] }, () => {});
    let calls = 0;
    watch(
      () => state.list,
      () => calls++,
      { deep: true }
    );
    state.list[1] = { id: 2 };
    expect(calls).toBe(1);
  });
});

describe("nested arrays", () => {
  test("an effect over inner arrays taken by iteration reruns after an inner write", () => {
    const state = reactive({ rows: [[1, 2], [3, 4]] }, () => {});
    let sums: number[] = [];
    watchEffect(() => {
      sums = [];
      for (const row of state.rows) sums.push(row.reduce((sum, value) => sum + value, 0));
    });
    state.rows[1][0] = 10;
    expect(sums).toEqual([3, 14]);
    state.rows[0].length = 1;
    expect(sums).toEqual([1, 14]);
    delete state.rows[1][1];
    expect(sums).toEqual([1, 10]);
  });

  test("a write to the outer array reruns a reader of the outer array only", () => {
    const state = reactive({ rows: [[1], [2]] }, () => {});
    let outer = 0;
    let inner = 0;
    watchEffect(() => {
      outer++;
      state.rows.map((row) => row.length);
    });
    watchEffect(() => {
      inner++;
      state.rows[0].map((value) => value);
    });
    state.rows[1] = [5];
    expect([outer, inner]).toEqual([2, 1]);
    state.rows[0][0] = 9;
    expect([outer, inner]).toEqual([2, 2]);
  });
});

describe("an array proxy answers like the array", () => {
  // until 3.0.1 the method cache found these on Object.prototype
  test("toString, toLocaleString and a template give the items", () => {
    const state = reactive({ list: [1, 2, 3] }, () => {});
    expect([String(state.list), `${state.list}`, state.list.toString(), state.list.toLocaleString()]).toEqual([
      "1,2,3",
      "1,2,3",
      "1,2,3",
      "1,2,3",
    ]);
  });

  test("constructor, __proto__ and valueOf are the array's", () => {
    const state = reactive({ list: [1, 2, 3] }, () => {});
    expect(state.list.constructor).toBe(Array);
    expect((state.list as any).__proto__).toBe(Array.prototype);
    expect(state.list.valueOf()).toBe(state.list);
  });
});
