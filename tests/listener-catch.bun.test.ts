import { expect, test } from "bun:test";
import fc from "fast-check";
import type * as Library from "../src/index";
import { listenerCatchArbitrary, runListenerCatchCase } from "./listener-catch.model.mjs";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index") as typeof Library;

test("listeners catch errors, retry writes, and keep replicas equal after every operation", () => {
  fc.assert(fc.property(listenerCatchArbitrary, spec => {
    const result = runListenerCatchCase(lib, spec);
    expect(result.mismatch).toBeUndefined();
    expect(result.source).toBe(result.replica);
    expect(result.done).toBe(spec.rounds);
    expect(result.retryValue).toBe(spec.initial + result.attempts);
    expect(result.caught).toBeGreaterThan(0);
    if (spec.refusal) {
      expect(result.loop).toBe(100 * spec.rounds);
      expect(result.callerErrors).toBe(spec.rounds);
      expect(result.rejected).toBe(result.attempts - 1);
    } else {
      expect(result.loop).toBe(spec.depth * spec.rounds);
      expect(result.rejected).toBe(0);
    }
  }), { seed: Number(process.env.RPS_PROPERTY_SEED ?? 20261109), numRuns: Number(process.env.RPS_PROPERTY_RUNS ?? 500) });
});
