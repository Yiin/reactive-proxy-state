import { test } from "bun:test";
import { objectDefineCases } from "./object-define.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = objectDefineCases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./object-define.cases.mjs", Object.keys(cases).length);

// The source's node, not a bundle's: `dataOnly` and `hidden` are internal.
test("an own accessor marks the object as one with accessors, and an accessor define marks it so", async () => {
  const { reactive, toRaw } = await import("../src/index");
  const { getLocationNode } = await import("../src/location");
  const { expect } = await import("bun:test");
  const raw = Object.defineProperty({ a: 1 }, "foo", { get: () => 1, set: () => {}, configurable: true });
  const state = reactive({ obj: raw }, () => {});
  state.obj.a = 2;
  const node = getLocationNode(toRaw(state.obj))!;
  expect(node.dataOnly).toBe(false);
  expect([...node.hidden!]).toEqual(["foo"]);
  Object.defineProperty(state.obj, "foo", { value: 3, writable: true, enumerable: true, configurable: true });
  // the hidden setter became an enumerable data key: the next write looks at
  // the keys again, and finds no accessor (3.0.18 review F5)
  expect(node.dataOnly).toBe(undefined);
  expect(node.hidden).toBe(null);
  state.obj.foo = 4;
  expect(toRaw(state.obj).foo).toBe(4);
  expect(node.dataOnly).toBe(true);
  // a plain object is marked on its first write; an accessor define marks it as one with accessors
  const plain = reactive({ obj: { a: 1 } }, () => {});
  plain.obj.a = 2;
  const plainNode = getLocationNode(toRaw(plain.obj))!;
  expect(plainNode.dataOnly).toBe(true);
  expect(plainNode.hidden).toBe(null);
  let hidden = 0;
  Object.defineProperty(plain.obj, "g", { get: () => hidden, set: (value) => (hidden = value), configurable: true });
  expect(plainNode.dataOnly).toBe(false);
  expect([...plainNode.hidden!]).toEqual(["g"]);
  plain.obj.g = 5;
  expect(hidden).toBe(5);
  expect(toRaw(plain.obj).g).toBe(5);
  // flags alone on an accessor show it
  Object.defineProperty(plain.obj, "g", { enumerable: true });
  expect(plainNode.hidden).toBe(null);
});

// 3.0.18 kept reading a descriptor per write after the last accessor went
// (3.0.18 review F5). A delete or a define that makes an accessor data has
// the next write look at the keys once; an object with more than 64 keys
// reads a descriptor per write and never looks again.
test("an object whose last accessor went reads no descriptor per write after one look", async () => {
  const { reactive, toRaw } = await import("../src/index");
  const { getLocationNode } = await import("../src/location");
  const { expect } = await import("bun:test");
  for (const kind of ["object", "array"]) {
    const raw: any = kind === "object" ? { a: 1 } : Object.assign([1], { name: 0 });
    Object.defineProperty(raw, "g", { get: () => 1, set: () => {}, enumerable: true, configurable: true });
    Object.defineProperty(raw, "h", { get: () => 1, set: () => {}, enumerable: true, configurable: true });
    const state = reactive({ obj: raw }, () => {});
    const write = () => (kind === "object" ? (state.obj.a = Math.random()) : (state.obj.name = Math.random()));
    write();
    const node = getLocationNode(toRaw(state.obj))!;
    expect(node.dataOnly).toBe(false);
    // one accessor left: the look finds it and the object keeps reading
    delete state.obj.g;
    expect(node.dataOnly).toBe(undefined);
    write();
    expect(node.dataOnly).toBe(false);
    expect(countLooks(write).descriptors).toBe(1);
    // the last one made data
    Object.defineProperty(state.obj, "h", { value: 2, writable: true, enumerable: true, configurable: true });
    expect(node.dataOnly).toBe(undefined);
    write();
    expect(node.dataOnly).toBe(true);
    expect(countLooks(() => { write(); write(); })).toEqual({ descriptors: 0, keyLists: 0 });
    // a delete on a data-only object changes nothing
    delete state.obj.h;
    expect(node.dataOnly).toBe(true);
  }
  // more than 64 keys: a descriptor per write, and no look after a delete
  const big: any = {};
  for (let i = 0; i < 100; i++) big["k" + i] = i;
  const state = reactive({ big }, () => {});
  state.big.k1 = 0;
  const node = getLocationNode(toRaw(state.big))!;
  expect(node.dataOnly).toBe(null);
  expect(countLooks(() => {
    state.big.extra = 1;
    delete state.big.extra;
    state.big.k1 = 2;
  })).toEqual({ descriptors: 1, keyLists: 0 });
  expect(node.dataOnly).toBe(null);
});

/** Counts the descriptor reads and key lists `body` makes. */
function countLooks(body: () => void): { descriptors: number; keyLists: number } {
  const descriptor = Reflect.getOwnPropertyDescriptor;
  const ownKeys = Reflect.ownKeys;
  const counts = { descriptors: 0, keyLists: 0 };
  Reflect.getOwnPropertyDescriptor = (target: object, key: PropertyKey) => {
    counts.descriptors++;
    return descriptor(target, key);
  };
  Reflect.ownKeys = (target: object) => {
    counts.keyLists++;
    return ownKeys(target);
  };
  try {
    body();
  } finally {
    Reflect.getOwnPropertyDescriptor = descriptor;
    Reflect.ownKeys = ownKeys;
  }
  return counts;
}

// 3.0.17 read a descriptor at each `=` write of an object with one hidden
// key, also after that key was deleted, and rescanned the object after a
// define of a new enumerable key (3.0.17 review F2, F4).
test("an object with a hidden key reads no descriptor per write, and a define of a new key does not look at its keys again", async () => {
  const { reactive, toRaw } = await import("../src/index");
  const { getLocationNode } = await import("../src/location");
  const { expect } = await import("bun:test");
  const events: string[] = [];
  const state = reactive({ obj: { a: 1, b: 2 } }, (event) => events.push(`${event.action} ${event.path.join(".")}`));
  events.length = 0;
  state.obj.a = 2;
  const node = getLocationNode(toRaw(state.obj))!;
  expect(node.dataOnly).toBe(true);
  expect(node.hidden).toBe(null);
  Object.defineProperty(state.obj, "b", { enumerable: false });
  expect(node.dataOnly).toBe(true);
  expect([...node.hidden!]).toEqual(["b"]);
  expect(countLooks(() => {
    state.obj.b = 3;
    state.obj.a = 3;
    state.obj.a = 4;
  })).toEqual({ descriptors: 0, keyLists: 0 });
  Object.defineProperty(state.obj, "b", { enumerable: true });
  expect(node.hidden).toBe(null);
  Object.defineProperty(state.obj, "h", { value: 1, enumerable: false, writable: true, configurable: true });
  expect([...node.hidden!]).toEqual(["h"]);
  delete state.obj.h;
  expect(node.hidden).toBe(null);
  expect(node.dataOnly).toBe(true);
  // a define of a new enumerable key keeps the marks: the next write looks at nothing
  Object.defineProperty(state.obj, "z", { value: 1, enumerable: true, writable: true, configurable: true });
  expect(countLooks(() => {
    state.obj.a = 5;
    state.obj.z = 2;
  })).toEqual({ descriptors: 0, keyLists: 0 });
  expect(node.dataOnly).toBe(true);
  expect(node.hidden).toBe(null);
  expect(events).toEqual(["set obj.a", "delete obj.b", "set obj.a", "set obj.a", "set obj.b", "set obj.z", "set obj.a", "set obj.z"]);
  expect(toRaw(state.obj)).toEqual({ a: 5, b: 3, z: 2 });
});
