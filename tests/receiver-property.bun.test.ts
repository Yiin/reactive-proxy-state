import { expect, test } from "bun:test";
import fc from "fast-check";
import * as source from "../src/index";
import { model, modelRuns, receiverArbitrary, runReceivers, writesRaw } from "./receiver-property.model.mjs";
const lib = process.env.RPS_TEST_BUNDLE ? await import(process.env.RPS_TEST_BUNDLE) : source;

/** Checks one case of the receiver property on `bundle`; gives whether the replica had to equal the container. */
function checkReceivers(bundle: any, spec: any): boolean {
  const direct = runReceivers(bundle, spec, true);
  const through = runReceivers(bundle, spec, false);
  expect(through).toEqual(direct);
  const expected = model(spec);
  const { runs, children, source, replica, other, otherReplica, closures } = direct;
  expect({ runs, children, source, replica, other, otherReplica, closures }).toEqual(expected);
  expect(direct.results.every((result: boolean) => result === true)).toBe(true);
  // a raw write changes the container and no replica (README, "Raw writes")
  if (writesRaw(spec)) return false;
  expect(direct.replica).toBe(direct.source);
  expect(direct.otherReplica).toBe(direct.other);
  return true;
}

test("writes through outer proxies, foreign receivers and setters, on arrays and objects, match the model and the direct write", () => {
  let routed = 0;
  let replicated = 0;
  const kinds = new Set<string>();
  fc.assert(
    fc.property(receiverArbitrary, (spec) => {
      if (checkReceivers(lib, spec)) replicated++;
      kinds.add(spec.kind);
      routed += spec.writes.filter((write) => write.route !== "direct").length;
    }),
    { seed: Number(process.env.RPS_PROPERTY_SEED ?? 20261110), numRuns: Number(process.env.RPS_PROPERTY_RUNS ?? 500) }
  );
  expect(routed).toBeGreaterThan(0);
  expect(replicated).toBeGreaterThan(0);
  expect([...kinds].sort()).toEqual(["array", "object"]);
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

// Each case fails on published 3.0.14 and passes now.
test("the receiver property detects the 3.0.14 setter and receiver gaps", async () => {
  const published = await import("./fixtures/published-3.0.14.js");
  const cases = {
    // an own closure-backed setter reran no reader of its key
    "own closure setter": { kind: "array", items: [1], bar: null, effects: [["ownHidden"]], writes: [{ write: { key: "ownHidden", value: 2 }, route: "direct" }] },
    // an own setter that writes two keys reran a reader of both twice
    "own two-key setter": { kind: "array", items: [1], bar: null, effects: [["bar", "extra"]], writes: [{ write: { key: "ownMirror", value: 2 }, route: "outer" }] },
    // a setter with no getter written undefined did not run
    "getter-less setter, undefined": { kind: "array", items: [1], bar: null, effects: [["extra"]], writes: [{ write: { key: "sink", value: undefined }, route: "direct" }] },
    // a child write through a setter whose getter gave the value did not run the setter
    "child receiver, the getter's value": { kind: "array", items: [1], bar: 1, effects: [["mirror"]], writes: [{ write: { key: "mirror", value: 1 }, route: "child" }] },
    // an inherited setter on an object sent `set` of its key: the replica held it as data
    "object inherited setter": { kind: "object", items: [1], bar: null, effects: [["hidden"]], writes: [{ write: { key: "hidden", value: 2 }, route: "direct" }] },
    // a child write on an object sent an event for a write that landed on the child
    "object child data write": { kind: "object", items: [1], bar: null, effects: [["a"]], writes: [{ write: { key: "a", value: 2 }, route: "child" }] },
  };
  for (const [name, spec] of Object.entries(cases)) {
    const old = runReceivers(published, spec, true);
    const expected = model(spec);
    const oldMatches =
      JSON.stringify([old.runs, old.children, old.source, old.replica, old.closures]) ===
      JSON.stringify([expected.runs, expected.children, expected.source, expected.replica, expected.closures]);
    expect({ name, oldMatches }).toEqual({ name, oldMatches: false });
    checkReceivers(lib, spec);
  }
});

// Each case fails on published 3.0.15 and passes now.
test("the receiver property detects the 3.0.15 writes that landed with no event", async () => {
  const published = await import("./fixtures/published-3.0.15.js");
  const cases = {
    // an outer proxy with a `getPrototypeOf` trap wrote the object and sent nothing
    "object membrane data write": { kind: "object", items: [1], bar: null, effects: [["a"]], writes: [{ write: { key: "a", value: 2 }, route: "membrane" }] },
    // ... and the same for a key the object did not have
    "object membrane new key": { kind: "object", items: [], bar: null, effects: [["bar"]], writes: [{ write: { key: "bar", value: 2 }, route: "membrane" }] },
    // a membrane setter write ran the setter for a value its getter already gave
    "array membrane setter, the getter's value": { kind: "array", items: [1], bar: 1, effects: [["extra"]], writes: [{ write: { key: "mirror", value: 1 }, route: "membrane" }] },
    // another proxy of the state as receiver: the write landed on its raw object with no event
    "object other proxy as receiver": { kind: "object", items: [1], bar: null, effects: [["a"]], writes: [{ write: { key: "a", value: 2 }, route: "other" }] },
    "array other proxy as receiver": { kind: "array", items: [1], bar: null, effects: [["0"]], writes: [{ write: { key: "0", value: 2 }, route: "other" }] },
    // `Object.defineProperty` with a value on an object sent nothing
    "object define": { kind: "object", items: [1], bar: null, effects: [["a"]], writes: [{ write: { key: "a", value: 2 }, route: "defineProperty" }] },
  };
  for (const [name, spec] of Object.entries(cases)) {
    const old = runReceivers(published, spec, false);
    const expected = model(spec);
    const keys = ["runs", "children", "source", "replica", "other", "otherReplica", "closures"] as const;
    const oldMatches = JSON.stringify(keys.map((key) => old[key])) === JSON.stringify(keys.map((key) => expected[key]));
    expect({ name, oldMatches }).toEqual({ name, oldMatches: false });
    checkReceivers(lib, spec);
  }
});

test("the receiver property detects the 3.0.16 hidden keys sent to replicas", async () => {
  const published = await import("./fixtures/published-3.0.16.js");
  const cases = {
    "object new hidden key": { kind: "object", items: [1], bar: null, hush: null, effects: [["hush"]], writes: [{ write: { key: "hush", value: 2, op: "hidden" }, route: "direct" }] },
    "object hidden key written by =": { kind: "object", items: [1], bar: null, hush: 1, effects: [["hush"]], writes: [{ write: { key: "hush", value: 2 }, route: "direct" }] },
    "object key hidden by flags alone": { kind: "object", items: [1], bar: null, hush: null, effects: [["a"]], writes: [{ write: { key: "a", value: undefined, op: "hide" }, route: "outer" }] },
    "object hidden key shown": { kind: "object", items: [1], bar: null, hush: 1, effects: [["a"]], writes: [{ write: { key: "hush", value: undefined, op: "show" }, route: "membrane" }] },
    "array hidden name defined": { kind: "array", items: [1], bar: 1, hush: null, effects: [["bar"]], writes: [{ write: { key: "bar", value: 2, op: "hidden" }, route: "direct" }] },
    "array hidden name deleted": { kind: "array", items: [1], bar: null, hush: 1, effects: [["hush"]], writes: [{ write: { key: "hush", value: undefined, op: "delete" }, route: "direct" }] },
  };
  const keys = ["events", "runs", "children", "source", "replica", "other", "otherReplica", "closures"] as const;
  for (const [name, spec] of Object.entries(cases)) {
    const old = runReceivers(published, spec, false);
    const expected = model(spec);
    const oldMatches = JSON.stringify(keys.slice(1).map((key) => old[key])) === JSON.stringify(keys.slice(1).map((key) => (expected as any)[key]));
    const sameEvents = JSON.stringify(old.events) === JSON.stringify(runReceivers(lib, spec, false).events);
    expect({ name, oldMatches: oldMatches && sameEvents }).toEqual({ name, oldMatches: false });
    checkReceivers(lib, spec);
  }
});
