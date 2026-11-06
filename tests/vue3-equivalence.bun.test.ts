import { describe, expect, test } from "bun:test";
import { reactive, toRaw } from "vue";
import { deepEqual, trackVueReactiveEvents, updateState } from "../src/index";
import { trackVueReactiveEvents as trackVueReactiveEvents200 } from "./fixtures/vue3-tracker-2.0.0";
import { runEquivalenceFuzz } from "./vue3-equivalence.ops.mjs";

// The tracker sends the same events as 2.0.0 for the same edits. Node runs the
// same fuzz on two installed packages: tests/vue3-equivalence.node.mjs.
// FUZZ_SEEDS raises the number of histories (300 edits each).

describe("trackVueReactiveEvents against 2.0.0", () => {
  test("same events for random edits, paused edits send nothing, replicas converge", () => {
    const seeds = Number(process.env.FUZZ_SEEDS ?? 40);
    const result = runEquivalenceFuzz({
      lib: { reactive, toRaw, updateState, deepEqual },
      reference: trackVueReactiveEvents200,
      candidate: trackVueReactiveEvents,
      seeds,
      ops: 300,
    });
    expect(result.failures).toEqual([]);
    expect(result.editsChecked).toBe(seeds * 300);
    expect(result.eventsChecked).toBeGreaterThan(seeds * 100);
  }, 120_000);
});
