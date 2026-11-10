import { test } from "bun:test";
import { objectDefineCases } from "./object-define.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = objectDefineCases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./object-define.cases.mjs", Object.keys(cases).length);

// The source's node, not a bundle's: `dataOnly` is internal.
test("a define over an own setter leaves the object marked as one with accessors, and an accessor define clears the mark", async () => {
  const { reactive, toRaw } = await import("../src/index");
  const { getLocationNode } = await import("../src/location");
  const { expect } = await import("bun:test");
  const raw = Object.defineProperty({ a: 1 }, "foo", { get: () => 1, set: () => {}, configurable: true });
  const state = reactive({ obj: raw }, () => {});
  state.obj.a = 2;
  const node = getLocationNode(toRaw(state.obj))!;
  expect(node.dataOnly).toBe(false);
  Object.defineProperty(state.obj, "foo", { value: 3, writable: true, enumerable: true, configurable: true });
  // still false: the object may hold other accessors, and false is always safe
  expect(node.dataOnly).toBe(false);
  state.obj.foo = 4;
  expect(toRaw(state.obj).foo).toBe(4);
  // a data-only object is marked on its first write; an accessor define clears the mark
  const plain = reactive({ obj: { a: 1 } }, () => {});
  plain.obj.a = 2;
  const plainNode = getLocationNode(toRaw(plain.obj))!;
  expect(plainNode.dataOnly).toBe(true);
  let hidden = 0;
  Object.defineProperty(plain.obj, "g", { get: () => hidden, set: (value) => (hidden = value), configurable: true });
  expect(plainNode.dataOnly).toBe(undefined);
  plain.obj.g = 5;
  expect(hidden).toBe(5);
  expect(toRaw(plain.obj).g).toBe(5);
});
