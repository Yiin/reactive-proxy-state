import { expect, test } from "bun:test";
import { reactive } from "../src/index";
import type { StateEvent } from "../src/types";

/**
 * An async flush that keeps growing (a listener writes again for each event
 * it gets) lets go of the events it delivered, in chunks, before it ends.
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
      if (event.action === "set" && delivered < TOTAL) state.n++;
    },
    [],
    { async: true }
  );
  state.n++;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(delivered).toBe(TOTAL);
  // a few may stay reachable from the stack; the queue holds none of them
  expect(collected).toBeGreaterThan(900);
});
