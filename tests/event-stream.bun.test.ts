import { expect, test } from "bun:test";
import * as lib from "../src/index";
import recorded from "./fixtures/events-3.0.3.json";
import intended from "./fixtures/events-3.0.4-intended.json";
// @ts-expect-error shared JavaScript recorder
import { recordEvents } from "./event-stream.ops.mjs";

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
