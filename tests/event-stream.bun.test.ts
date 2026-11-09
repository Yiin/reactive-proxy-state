import { expect, test } from "bun:test";
import * as lib from "../src/index";
import recorded from "./fixtures/events-3.0.3.json";
import intended from "./fixtures/events-3.0.4-intended.json";
import listenerRecorded from "./fixtures/events-listener-writes-3.0.3.json";
import listenerIntended from "./fixtures/events-listener-writes-3.0.6-intended.json";
// @ts-expect-error shared JavaScript recorder
import { recordEvents, recordListenerWrites } from "./event-stream.ops.mjs";

test("events match published 3.0.3 except the recorded dropped-write fixes", async () => {
  const cases: Record<string, string[]> = await recordEvents(lib);
  const expected: Record<string, string[]> = { ...recorded, ...intended };
  expect(Object.keys(cases).sort()).toEqual(Object.keys(expected).sort());
  for (const [name, events] of Object.entries(expected)) {
    expect({ name, events: cases[name] }).toEqual({ name, events });
  }
  const differences = Object.keys(intended);
  expect(differences).toHaveLength(18);
  expect(differences.every(name => name.includes("getOrInsert") || name.endsWith("object: set of a new key to undefined"))).toBe(true);
});

test("listeners that write get published 3.0.3's events, except where effects or queued events now wait", () => {
  const cases: Record<string, string[]> = recordListenerWrites(lib);
  const expected: Record<string, string[]> = { ...listenerRecorded, ...listenerIntended };
  expect(Object.keys(cases).sort()).toEqual(Object.keys(expected).sort());
  for (const [name, events] of Object.entries(expected)) {
    expect({ name, events: cases[name] }).toEqual({ name, events });
  }
  expect(Object.keys(cases).filter(name => cases[name].at(-1) !== "replica equals the source")).toEqual([]);
  // An effect that reads what the listener writes runs after the outermost
  // write, where 3.0.3 ran it inside the listener's write. A listener's
  // write while several events wait goes after them
  const differences = Object.keys(listenerIntended);
  expect(differences).toHaveLength(36);
  expect(differences.every(name =>
    name.includes("an effect that reads the stamp") || name.endsWith(": a longer length") || name.endsWith(": an alias write")
  )).toBe(true);
});
