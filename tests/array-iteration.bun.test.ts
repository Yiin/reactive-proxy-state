import { describe, expect, test } from "bun:test";
import { deepToRaw, getProxyStats, isReactive, reactive, toRaw, watchEffect } from "../src/index";
import { replicate } from "./replica";

/**
 * An item taken out of an array proxy by iteration is the item's proxy, as
 * an index read gives it: a write through it reaches the replica at the
 * index the item holds when the write happens. 3.0.0 iterated the raw
 * array, so a write through an item from `for...of` or a spread sent
 * nothing (vangrd-cfb72: run history written to a job found in a spread
 * job list after a splice never reached the clients).
 */

type Job = { id: number; history: number[]; meta: { runs: number } };

const job = (id: number): Job => ({ id, history: [], meta: { runs: 0 } });

/** Every way an item leaves the proxy through its iterator. */
const forms: Record<string, (list: Job[], id: number) => Job | undefined> = {
  "for...of": (list, id) => {
    for (const item of list) if (item.id === id) return item;
    return undefined;
  },
  spread: (list, id) => [...list].find((item) => item.id === id),
  "spread of two lists": (list, id) => [...list, ...[]].find((item) => item.id === id),
  "Array.from": (list, id) => Array.from(list).find((item) => item.id === id),
  "Array.from with a map function": (list, id) => Array.from(list, (item) => item).find((item) => item.id === id),
  destructuring: (list, id) => {
    const [first, second, ...rest] = list;
    return [first, second, ...rest].find((item) => item?.id === id);
  },
  "values()": (list, id) => {
    for (const item of list.values()) if (item.id === id) return item;
    return undefined;
  },
  "entries()": (list, id) => {
    for (const [index, item] of list.entries()) if (item.id === id && list[index] === item) return item;
    return undefined;
  },
  "[Symbol.iterator]().next()": (list, id) => {
    const iterator = list[Symbol.iterator]();
    for (let step = iterator.next(); !step.done; step = iterator.next()) if (step.value.id === id) return step.value;
    return undefined;
  },
  "new Set(list)": (list, id) => [...new Set(list)].find((item) => item.id === id),
  "findLast": (list, id) => list.findLast((item) => item.id === id),
};

/** Structural changes that move the item with id 2 (or leave it in place). */
const moves: Record<string, { move: (list: Job[]) => unknown; index: number }> = {
  "no move": { move: () => {}, index: 1 },
  "splice removes an earlier item": { move: (list) => list.splice(0, 1), index: 0 },
  "splice inserts before it": { move: (list) => list.splice(0, 0, job(9)), index: 2 },
  shift: { move: (list) => list.shift(), index: 0 },
  unshift: { move: (list) => list.unshift(job(9), job(10)), index: 3 },
  reverse: { move: (list) => list.reverse(), index: 1 },
  sort: { move: (list) => list.sort((a, b) => b.id - a.id), index: 1 },
  "copyWithin over it": { move: (list) => list.copyWithin(0, 1), index: 0 },
};

describe("items taken out of an array proxy stay live", () => {
  for (const [formName, take] of Object.entries(forms)) {
    describe(formName, () => {
      for (const [moveName, { move, index }] of Object.entries(moves)) {
        test(`taken after: ${moveName}`, () => {
          const root = replicate({ jobs: [job(1), job(2), job(3)] });
          move(root.state.jobs);
          root.clear();
          const taken = take(root.state.jobs, 2)!;
          expect(isReactive(taken)).toBe(true);
          taken.history.push(100);
          taken.meta.runs++;
          expect(root.paths()).toEqual([`array-push:jobs.${index}.history`, `set:jobs.${index}.meta.runs`]);
          expect(root.inSync()).toBe(true);
        });

        test(`taken before: ${moveName}`, () => {
          const root = replicate({ jobs: [job(1), job(2), job(3)] });
          const taken = take(root.state.jobs, 2)!;
          move(root.state.jobs);
          root.clear();
          taken.history.push(100);
          taken.meta.runs++;
          expect(root.paths()).toEqual([`array-push:jobs.${index}.history`, `set:jobs.${index}.meta.runs`]);
          expect(root.inSync()).toBe(true);
        });
      }
    });
  }

  test("a job found in a spread of account and village job lists after a pruning splice (vangrd-cfb72)", () => {
    const root = replicate({
      accounts: {
        7522: {
          jobs: [job(1), job(2), job(3)],
          villages: [{ jobs: [job(4)] }, { jobs: [job(5)] }],
        },
      },
    });
    const account = root.state.accounts[7522];
    account.jobs.splice(0, 1);
    root.clear();
    const inventory = [...account.jobs, ...account.villages[0].jobs, ...account.villages[1].jobs];
    inventory.find((candidate) => candidate.id === 2)!.history.push(12);
    inventory.find((candidate) => candidate.id === 5)!.history.push(13);
    expect(root.paths()).toEqual([
      "array-push:accounts.7522.jobs.0.history",
      "array-push:accounts.7522.villages.1.jobs.0.history",
    ]);
    expect(root.inSync()).toBe(true);
  });

  test("nested arrays and primitives come out as an index read gives them", () => {
    const root = replicate({ grid: [[1, 2], [3]], tags: ["a", "b"] });
    const [row] = root.state.grid;
    expect(isReactive(row)).toBe(true);
    expect(row).toBe(root.state.grid[0]);
    expect([...root.state.tags]).toEqual(["a", "b"]);
    row.push(9);
    expect(root.paths()).toEqual(["array-push:grid.0"]);
    expect(root.inSync()).toBe(true);
  });
});

describe("the array proxy iterator steps like the native one", () => {
  test("reads the length at every step, so a push during the loop is visited", () => {
    const state = reactive({ list: [{ id: 1 }, { id: 2 }] }, () => {});
    const seen: number[] = [];
    for (const item of state.list) {
      seen.push(item.id);
      if (item.id === 1) state.list.push({ id: 3 });
    }
    expect(seen).toEqual([1, 2, 3]);
  });

  test("a splice during the loop skips like the native iterator", () => {
    const plain = [1, 2, 3, 4];
    const state = reactive({ list: plain.slice() }, () => {});
    const native: number[] = [];
    for (const value of plain) {
      native.push(value);
      if (value === 2) plain.splice(0, 1);
    }
    const proxied: number[] = [];
    for (const value of state.list) {
      proxied.push(value);
      if (value === 2) state.list.splice(0, 1);
    }
    expect(proxied).toEqual(native);
  });

  test("holes read as undefined, done stays done, and the iterator is iterable", () => {
    const state = reactive({ list: [1, , 3] as (number | undefined)[] }, () => {});
    expect([...state.list]).toEqual([1, undefined, 3]);
    const iterator = state.list.values();
    expect(iterator[Symbol.iterator]()).toBe(iterator);
    expect([...iterator]).toEqual([1, undefined, 3]);
    state.list.push(4);
    expect(iterator.next()).toEqual({ value: undefined, done: true });
  });

  test("entries() gives [index, item] pairs and keys() gives indexes", () => {
    const state = reactive({ list: [{ id: 1 }, 7] as unknown[] }, () => {});
    const entries = [...state.list.entries()];
    expect(entries.map(([index]) => index)).toEqual([0, 1]);
    expect(entries[0][1]).toBe(state.list[0]);
    expect(entries[1][1]).toBe(7);
    expect([...state.list.keys()]).toEqual([0, 1]);
  });

  test("iterator helpers work where the engine has them", () => {
    const state = reactive({ list: [{ id: 1 }, { id: 2 }] }, () => {});
    const iterator = state.list.values() as any;
    if (typeof iterator.map !== "function") return;
    const mapped = iterator.map((item: { id: number }) => item).toArray();
    expect(mapped[1]).toBe(state.list[1]);
  });

  test("the raw array still iterates raw items", () => {
    const state = reactive({ list: [{ id: 1 }] }, () => {});
    const [item] = toRaw(state.list);
    expect(isReactive(item)).toBe(false);
  });
});

describe("indexOf, lastIndexOf and includes find proxies", () => {
  test("a proxy from an index read, find or iteration is found at its raw object's index", () => {
    const state = reactive({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] }, () => {});
    const second = state.list[1];
    const [, , third] = state.list;
    expect(state.list.indexOf(second)).toBe(1);
    expect(state.list.lastIndexOf(second)).toBe(1);
    expect(state.list.includes(second)).toBe(true);
    expect(state.list.indexOf(state.list.find((item) => item.id === 3)!)).toBe(2);
    expect(state.list.indexOf(third)).toBe(2);
    expect(state.list.indexOf(toRaw(third))).toBe(2);
  });

  test("fromIndex keeps its native meaning, also when given as undefined", () => {
    const plain = [{ id: 1 }, { id: 2 }, { id: 1 }];
    plain[2] = plain[0];
    const state = reactive({ list: plain.slice() }, () => {});
    const first = state.list[0];
    expect(state.list.indexOf(first, 1)).toBe(plain.indexOf(plain[0], 1));
    expect(state.list.lastIndexOf(first)).toBe(plain.lastIndexOf(plain[0]));
    expect(state.list.lastIndexOf(first, 1)).toBe(plain.lastIndexOf(plain[0], 1));
    expect(state.list.lastIndexOf(first, undefined)).toBe(plain.lastIndexOf(plain[0], undefined));
    expect(state.list.includes(first, 3)).toBe(false);
    expect(state.list.indexOf({ id: 1 })).toBe(-1);
  });

  test("primitives search natively, NaN included", () => {
    const state = reactive({ list: [1, NaN, 3] }, () => {});
    expect(state.list.includes(NaN)).toBe(true);
    expect(state.list.indexOf(NaN)).toBe(-1);
    expect(state.list.indexOf(3)).toBe(2);
  });

  test("a loop that removes items it iterates removes the right ones", () => {
    const root = replicate({ jobs: [job(1), job(2), job(3), job(4)] });
    for (const item of [...root.state.jobs]) {
      if (item.id % 2 === 0) root.state.jobs.splice(root.state.jobs.indexOf(item), 1);
    }
    expect(root.state.jobs.map((item) => item.id)).toEqual([1, 3]);
    expect(root.inSync()).toBe(true);
  });
});

describe("costs and effects", () => {
  test("deepToRaw of an array proxy makes no proxies", () => {
    const state = reactive({ list: [job(1), job(2)] }, () => {});
    const list = state.list;
    const before = getProxyStats().created;
    const copy = deepToRaw(list);
    expect(getProxyStats().created).toBe(before);
    expect(copy).toEqual([job(1), job(2)]);
    expect(isReactive(copy[0])).toBe(false);
  });

  test("an effect that iterates reruns on an item write, an index write, a push and a truncation", () => {
    const state = reactive({ list: [{ value: 1 }, { value: 2 }] });
    let total = 0;
    const stop = watchEffect(() => {
      total = 0;
      for (const item of state.list) total += item.value;
    });
    state.list[0].value = 5;
    expect(total).toBe(7);
    state.list[1] = { value: 10 };
    expect(total).toBe(15);
    state.list.push({ value: 1 });
    expect(total).toBe(16);
    state.list.length = 1;
    expect(total).toBe(5);
    stop();
  });

  test("an effect that uses find, at or includes reruns on a push, also after the method was read before", () => {
    const state = reactive({ list: [{ id: 1 }] });
    const extra = { id: 2 };
    // the first read of a method caches it on the proxy
    state.list.find(() => false);
    state.list.at(0);
    state.list.includes(extra);
    let found: unknown;
    let last: unknown;
    let included = false;
    const stop = watchEffect(() => {
      found = state.list.find((item) => item.id === 2);
      last = state.list.at(-1);
      included = state.list.includes(extra);
    });
    state.list.push(extra);
    expect(found).toBe(state.list[1]);
    expect(last).toBe(state.list[1]);
    expect(included).toBe(true);
    stop();
  });
});
