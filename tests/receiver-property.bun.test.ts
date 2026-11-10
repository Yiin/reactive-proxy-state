import { expect, test } from "bun:test";
import fc from "fast-check";
import * as source from "../src/index";
import { modelRuns, receiverArbitrary, runReceivers } from "./receiver-property.model.mjs";
const lib = process.env.RPS_TEST_BUNDLE ? await import(process.env.RPS_TEST_BUNDLE) : source;

test("writes through outer proxies and foreign receivers send the events and rerun the effects of direct writes", () => {
  let routed = 0;
  fc.assert(
    fc.property(receiverArbitrary, (spec) => {
      const direct = runReceivers(lib, spec, true);
      const through = runReceivers(lib, spec, false);
      expect(through).toEqual(direct);
      expect(direct.runs).toEqual(modelRuns(spec));
      expect(direct.replica).toEqual([]);
      expect(direct.results.every((result) => result === true)).toBe(true);
      routed += spec.writes.filter((write) => write.route !== "direct").length;
    }),
    { seed: Number(process.env.RPS_PROPERTY_SEED ?? 20261110), numRuns: Number(process.env.RPS_PROPERTY_RUNS ?? 500) }
  );
  expect(routed).toBeGreaterThan(0);
});

test("the receiver property detects the 3.0.12 duplicate events", async () => {
  const published = await import("./fixtures/published-3.0.12.js");
  const spec = {
    items: [1, 2],
    bar: null,
    effects: [["0", "length"]],
    writes: [
      { write: { key: "0", value: 9 }, route: "outer" },
      { write: { key: "length", value: 1 }, route: "outer" },
    ],
  };
  const direct = runReceivers(published, spec, true);
  const through = runReceivers(published, spec, false);
  expect(direct.runs).toEqual(modelRuns(spec));
  expect(through.events.length).toBe(2 * direct.events.length);
  expect(through.runs).not.toEqual(modelRuns(spec));
  expect(runReceivers(lib, spec, false)).toEqual(runReceivers(lib, spec, true));
});

test("the receiver property detects the 3.0.13 accessor writes", async () => {
  const published = await import("./fixtures/published-3.0.13.js");
  // `hidden` keeps its value in a closure: 3.0.13 reran none of its readers
  const hidden = {
    items: [1],
    bar: null,
    effects: [["hidden"]],
    writes: [{ write: { key: "hidden", value: 2 }, route: "direct" }],
  };
  // `mirror` writes `bar` and `extra`: 3.0.13 reran a reader of both twice
  const mirror = {
    items: [1],
    bar: null,
    effects: [["bar", "extra"]],
    writes: [{ write: { key: "mirror", value: 2 }, route: "outer" }],
  };
  for (const spec of [hidden, mirror]) {
    expect(runReceivers(published, spec, true).runs).not.toEqual(modelRuns(spec));
    expect(runReceivers(lib, spec, true).runs).toEqual(modelRuns(spec));
    expect(runReceivers(lib, spec, false)).toEqual(runReceivers(lib, spec, true));
  }
});
