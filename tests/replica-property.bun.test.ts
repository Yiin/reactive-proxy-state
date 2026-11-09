import { expect, test } from "bun:test";
import fc from "fast-check";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type * as Library from "../src/index";
import { caseArbitrary, comparable, runCase } from "./replica-property.model.mjs";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index") as typeof Library;
// The dist/index.js of the npm tarball of 3.0.6, checked against
// `npm view @yiin/reactive-proxy-state@3.0.6 dist.integrity`. Do not edit.
const baselineUrl = new URL("./fixtures/published-3.0.6.js", import.meta.url);
const baseline = await import(baselineUrl.href) as typeof Library;

// RPS_PROPERTY_SEED and RPS_PROPERTY_RUNS run other or more cases;
// tests/replica-property.run.mjs runs many seeds on built bundles
const seed = Number(process.env.RPS_PROPERTY_SEED ?? 20261109);
const numRuns = Number(process.env.RPS_PROPERTY_RUNS ?? 500);

test("the 3.0.6 bundle is the published one", () => {
  expect(createHash("sha256").update(readFileSync(baselineUrl)).digest("hex")).toBe(
    "4d08a217bd023722934b74fa5445a679a2dedc4f126f4216319756b8813f09af"
  );
});

test("a replica of a listener that writes state equals the source after every write, in 3.0.6's event order", () => {
  fc.assert(
    fc.property(caseArbitrary(), (spec) => {
      const ours = runCase(lib, spec);
      expect(ours.mismatch).toBeUndefined();
      // Only finite cases without listener-read dependencies can run on 3.0.6.
      if (comparable(spec)) expect(ours.log).toEqual(runCase(baseline, spec).log);
    }),
    { seed, numRuns }
  );
});
