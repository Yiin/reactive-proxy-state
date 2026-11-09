import { expect, test } from "bun:test";
import { reactive } from "../src/index";
import type { StateEvent } from "../src/types";

/**
 * A large async batch releases delivered events in chunks before it ends.
 * Caller writes fill this batch: listener chains now stop after 100 rounds.
 */
test("a long async flush releases the events it delivered", async () => {
  const TOTAL = 6_000;
  const early: WeakRef<object>[] = [];
  let delivered = 0;
  let collected = -1;
  const state = reactive(
    { n: 0 },
    (event: StateEvent) => {
      delivered++;
      if (early.length < 1_000 && event.action === "set") early.push(new WeakRef(event));
      if (delivered === TOTAL - 10) {
        Bun.gc(true);
        collected = early.filter((ref) => ref.deref() === undefined).length;
      }
    },
    [],
    { async: true }
  );
  for (let value = 1; value < TOTAL; value++) state.n = value;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(delivered).toBe(TOTAL);
  // a few may stay reachable from the stack; the queue holds none of them
  expect(collected).toBeGreaterThan(900);
});
