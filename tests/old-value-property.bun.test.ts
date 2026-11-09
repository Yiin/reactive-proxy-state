import { expect, test } from "bun:test";
import fc from "fast-check";
import * as lib from "../src/index";
import { oldValueArbitrary, runOldValue } from "./old-value-property.model.mjs";
test("queued collection removals keep the generated old object", () => {
  fc.assert(fc.property(oldValueArbitrary, spec => {
    const result = runOldValue(lib, spec);
    expect(result.observed).toBe(result.expected);
  }), { seed: Number(process.env.RPS_PROPERTY_SEED ?? 20261109), numRuns: Number(process.env.RPS_PROPERTY_RUNS ?? 500) });
});
