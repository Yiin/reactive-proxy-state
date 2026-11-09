import { expect, test } from "bun:test";
import fc from "fast-check";
import * as source from "../src/index";
import { oracleArbitrary, runOracle } from "./effect-oracle.model.mjs";
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
