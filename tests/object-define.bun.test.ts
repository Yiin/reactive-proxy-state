import { test } from "bun:test";
import { objectDefineCases } from "./object-define.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = objectDefineCases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./object-define.cases.mjs", Object.keys(cases).length);

// The source's node, not a bundle's: `plainData` is internal.
test("a define over an own setter leaves the object marked as one with accessors, and an accessor define clears the mark", async () => {
  const { reactive, toRaw } = await import("../src/index");
  const { getLocationNode } = await import("../src/location");
  const { expect } = await import("bun:test");
  const raw = Object.defineProperty({ a: 1 }, "foo", { get: () => 1, set: () => {}, configurable: true });
  const state = reactive({ obj: raw }, () => {});
  state.obj.a = 2;
  const node = getLocationNode(toRaw(state.obj))!;
  expect(node.plainData).toBe(false);
  Object.defineProperty(state.obj, "foo", { value: 3, writable: true, enumerable: true, configurable: true });
  // the hidden setter became an enumerable key: the next write looks again
  expect(node.plainData).toBe(undefined);
  state.obj.foo = 4;
  expect(toRaw(state.obj).foo).toBe(4);
  // a plain object is marked on its first write; an accessor define marks it as not plain
  const plain = reactive({ obj: { a: 1 } }, () => {});
  plain.obj.a = 2;
  const plainNode = getLocationNode(toRaw(plain.obj))!;
  expect(plainNode.plainData).toBe(true);
  let hidden = 0;
  Object.defineProperty(plain.obj, "g", { get: () => hidden, set: (value) => (hidden = value), configurable: true });
  expect(plainNode.plainData).toBe(false);
  plain.obj.g = 5;
  expect(hidden).toBe(5);
  expect(toRaw(plain.obj).g).toBe(5);
});

// A hidden key makes the object not plain: a write by `=` of it reads its
// descriptor, and keeps it hidden. Showing it again lets the next write look again.
test("a define that hides a key marks the object as not plain, and one that shows it looks again", async () => {
  const { reactive, toRaw } = await import("../src/index");
  const { getLocationNode } = await import("../src/location");
  const { expect } = await import("bun:test");
  const events: string[] = [];
  const state = reactive({ obj: { a: 1, b: 2 } }, (event) => events.push(`${event.action} ${event.path.join(".")}`));
  events.length = 0;
  state.obj.a = 2;
  const node = getLocationNode(toRaw(state.obj))!;
  expect(node.plainData).toBe(true);
  Object.defineProperty(state.obj, "b", { enumerable: false });
  expect(node.plainData).toBe(false);
  state.obj.b = 3;
  Object.defineProperty(state.obj, "b", { enumerable: true });
  expect(node.plainData).toBe(undefined);
  state.obj.a = 3;
  expect(node.plainData).toBe(true);
  expect(events).toEqual(["set obj.a", "delete obj.b", "set obj.b", "set obj.a"]);
  expect(toRaw(state.obj)).toEqual({ a: 3, b: 3 });
});
