import { expect, test } from "bun:test";
import fc from "fast-check";
import * as source from "../src/index";
import { oracleArbitrary, runOracle, wideOracleArbitrary } from "./effect-oracle.model.mjs";
const lib = process.env.RPS_TEST_BUNDLE ? await import(process.env.RPS_TEST_BUNDLE) : source;
test("effect runs match declared reads and the independent write model", () => {
  fc.assert(fc.property(oracleArbitrary, spec => {
    expect(runOracle(lib, spec).failure).toBeUndefined();
  }), { seed: Number(process.env.RPS_PROPERTY_SEED ?? 20261109), numRuns: Number(process.env.RPS_PROPERTY_RUNS ?? 500) });
});

test("the independent run oracle detects the 3.0.6 listener dependency leak", async () => {
  const baseline = await import("./fixtures/published-3.0.6.js");
  const spec = { reads: [["a"]], writes: [{ op: "a", value: 1 }, { op: "b", value: 1 }], throws: false };
  expect(runOracle(baseline, spec).failure).toBeDefined();
  expect(runOracle(lib, spec).failure).toBeUndefined();
});

test("wide cases: more than 100 stamped effect runs in one write match the model", () => {
  let reached = 0;
  let cases = 0;
  fc.assert(fc.property(wideOracleArbitrary, spec => {
    const result = runOracle(lib, spec);
    expect(result.failure).toBeUndefined();
    cases++;
    if (result.widest > 100) reached++;
  }), { seed: Number(process.env.RPS_PROPERTY_SEED ?? 20261109), numRuns: Number(process.env.RPS_WIDE_PROPERTY_RUNS ?? 60) });
  // over half the cases make one write that runs more than 100 listener writes (58% over 40 seeds)
  expect(reached).toBeGreaterThan(cases / 3);
});

test("the wide oracle detects the 3.0.7 breadth bound", async () => {
  const published307 = await import("./fixtures/published-3.0.7.js");
  const spec = { reads: Array.from({ length: 120 }, () => ["a"]), writes: [{ op: "a", value: 1 }], throws: false, stamp: true };
  expect(() => runOracle(published307, spec)).toThrow("100 nested write rounds");
  const result = runOracle(lib, spec);
  expect(result.failure).toBeUndefined();
  expect(result.widest).toBe(120);
});
