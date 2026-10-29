import { expect, test } from "bun:test";
import * as lib from "../src/index";
import { runDeepChecks } from "./deep-trees.ops.mjs";

// Node runs the same checks on the bundles: tests/deep-trees.node.mjs.
for (const depth of [8000, 100000]) {
  test(`stores, copies and location walks work at depth ${depth}`, () => {
    expect(runDeepChecks(lib, depth)).toEqual([]);
  }, 60000);
}
