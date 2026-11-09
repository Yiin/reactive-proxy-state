import { expect, test } from "bun:test";
import * as lib from "../src/index";
import recorded from "./fixtures/events-3.0.2.json";
// @ts-expect-error a plain JavaScript module shared with tests/event-stream.record.mjs
import { recordEvents } from "./event-stream.ops.mjs";

/**
 * A replica receives what it received from 3.0.2 for every write of the
 * matrix in tests/event-stream.ops.mjs: plain writes to objects, arrays,
 * Maps and Sets at several places, in sync and async roots, writes made by
 * effects, and writes a listener makes while it receives an event. The
 * fixture was recorded from the npm tarball of 3.0.2
 * (tests/event-stream.record.mjs).
 */
test("every write emits the events 3.0.2 emitted", async () => {
  const cases: Record<string, string[]> = await recordEvents(lib);
  expect(Object.keys(cases)).toEqual(Object.keys(recorded));
  for (const [name, events] of Object.entries(recorded as Record<string, string[]>)) {
    expect({ name, events: cases[name] }).toEqual({ name, events });
  }
});
