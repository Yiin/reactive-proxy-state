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

// 3.0.18 sent a symbol key as the string "Symbol(s)", sent a write inside an
// object an array name holds on the name's path, and counted a write under
// a hidden key as detached
test("the published 3.0.18 fails the property", async () => {
  const published = await import("./fixtures/published-3.0.18.js");
  expect(() => checkHiddenChildren(published, 1000, 1)).toThrow(/Property failed/);
  const symbol = runHiddenChildren(published, [{ op: "symbol", key: "a", value: 1 }]);
  expect(symbol?.why).toBe("replica");
  const name = [{ op: "set", key: "d", value: { fresh: "list" } }, { op: "name", key: "d", value: { alias: "other" } }, { op: "other", value: 3 }];
  expect(runHiddenChildren(published, name)?.why).toEqual({ sent: ["obj.d.meta.n", "other.n"], paths: ["other.n"] });
  const hidden = [{ op: "hide", key: "b" }, { op: "deep", key: "b", value: 1 }];
  expect(runHiddenChildren(published, hidden)?.why).toBe("detached write");
  for (const steps of [[{ op: "symbol", key: "a", value: 1 }], name, hidden]) expect(runHiddenChildren(lib, steps)).toBe(undefined);
});
