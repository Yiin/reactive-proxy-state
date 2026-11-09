import { describe, expect, test } from "bun:test";
import { reactive, toRaw, watchEffect } from "../src/index";

/**
 * `shift`, `unshift` and `splice` move items, and rerun an effect that read
 * an index only when that index holds another value, or a hole where it
 * held a value, or the reverse. Until 3.0.2 they reran every read index
 * they moved, also one that held what it held: `a.shift()` on `[1, 1, 2]`
 * reran an effect that read `a[0]`.
 */

/** Arrays with repeated values, holes and undefined. */
const arrays: Record<string, () => unknown[]> = {
  "[1, 1, 2]": () => [1, 1, 2],
  "[1, 1, 1]": () => [1, 1, 1],
  "[1, hole, 1]": () => [1, , 1],
  "[undefined, hole, undefined]": () => [undefined, , undefined],
  "[NaN, NaN, 0, -0]": () => [NaN, NaN, 0, -0],
  "[{}, {}] (two objects)": () => [{ id: 1 }, { id: 1 }],
};

const moves: Record<string, (list: unknown[]) => unknown> = {
  shift: (list) => list.shift(),
  "unshift of 1": (list) => list.unshift(1),
  "unshift of 1, 1": (list) => list.unshift(1, 1),
  "splice(0, 1, 1)": (list) => list.splice(0, 1, 1),
  "splice(0, 1)": (list) => list.splice(0, 1),
  "splice(1, 1)": (list) => list.splice(1, 1),
  "splice(0, 0, 1)": (list) => list.splice(0, 0, 1),
  "splice(1, 0, 1)": (list) => list.splice(1, 0, 1),
  "splice(0, 2, 1, 1)": (list) => list.splice(0, 2, 1, 1),
  "splice(0, 2, 1)": (list) => list.splice(0, 2, 1),
  "splice(-1, 1)": (list) => list.splice(-1, 1),
  "splice(1)": (list) => list.splice(1),
  "splice(0, 1, undefined)": (list) => list.splice(0, 1, undefined),
};

const sameAt = (before: readonly unknown[], after: readonly unknown[], index: number) =>
  Object.is(before[index], after[index]) && index in before === index in after;

describe("a move reruns an index read only when that index changed", () => {
  for (const [arrayName, make] of Object.entries(arrays)) {
    for (const [moveName, move] of Object.entries(moves)) {
      test(`${moveName} on ${arrayName}`, () => {
        const state = reactive({ list: make() }, () => {});
        const runs: number[] = [];
        for (let index = 0; index < 6; index++) {
          runs.push(0);
          watchEffect(() => {
            runs[index]++;
            state.list[index];
          });
        }
        let lengthRuns = 0;
        watchEffect(() => {
          lengthRuns++;
          state.list.length;
        });
        const before = toRaw(state.list).slice();
        move(state.list);
        const after = toRaw(state.list).slice();
        const expected = runs.map((_, index) => (sameAt(before, after, index) ? 1 : 2));
        expect({ indexes: runs, length: lengthRuns }).toEqual({
          indexes: expected,
          length: before.length === after.length ? 1 : 2,
        });
      });
    }
  }

  test("the reported cases: a[0] of [1, 1, 2] after shift, unshift(1) and splice(0, 1, 1)", () => {
    for (const move of [(list: number[]) => list.shift(), (list: number[]) => list.unshift(1), (list: number[]) => list.splice(0, 1, 1)]) {
      const state = reactive({ list: [1, 1, 2] }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.list[0];
      });
      move(state.list);
      expect(runs).toBe(1);
    }
  });

  test("a reader of all items reruns after every move that changed the array", () => {
    for (const [moveName, move] of Object.entries(moves)) {
      const state = reactive({ list: [1, 1, 2] as unknown[] }, () => {});
      let runs = 0;
      watchEffect(() => {
        runs++;
        state.list.map((value) => value);
      });
      const before = toRaw(state.list).slice();
      move(state.list);
      const after = toRaw(state.list).slice();
      const changed = before.length !== after.length || before.some((_, index) => !sameAt(before, after, index));
      // splice(0, 1, 1) puts back what it took: nothing changed
      expect({ moveName, runs }).toEqual({ moveName, runs: changed ? 2 : 1 });
    }
  });
});
