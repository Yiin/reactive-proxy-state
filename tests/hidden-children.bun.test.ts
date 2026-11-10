import { expect, test } from "bun:test";
import { checkHiddenChildren, runHiddenChildren } from "./hidden-children.property.mjs";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");

// Node runs it on the bundle: node tests/hidden-children.property.mjs dist/index.js <runs>
test("a replica holds what the source shows, with no warning, after random hides, shows, aliases and writes inside children", () => {
  checkHiddenChildren(lib, 1000);
});

// 3.0.17 sent a write inside an object a hidden key holds with its path
test("the published 3.0.17 fails the property", async () => {
  const published = await import("./fixtures/published-3.0.17.js");
  expect(() => checkHiddenChildren(published, 1000, 1)).toThrow(/Property failed/);
  const failure = runHiddenChildren(published, [{ op: "hide", key: "b" }, { op: "deep", key: "b", value: 1 }]);
  expect(failure?.warnings).toEqual(["parent path obj.b.m not found for action set"]);
  expect(runHiddenChildren(lib, [{ op: "hide", key: "b" }, { op: "deep", key: "b", value: 1 }])).toBe(undefined);
});
