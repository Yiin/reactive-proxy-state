import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { recordEvents } from "./event-stream.ops.mjs";

const baseline = JSON.parse(readFileSync(new URL("./fixtures/events-3.0.3.json", import.meta.url)));
const intended = JSON.parse(readFileSync(new URL("./fixtures/events-3.0.4-intended.json", import.meta.url)));
const events = await recordEvents(await import(pathToFileURL(resolve(process.argv[2])).href));
const text = JSON.stringify(events, null, 1) + "\n";
assert.equal(text, JSON.stringify({ ...baseline, ...intended }, null, 1) + "\n");
if (process.argv[3]) writeFileSync(process.argv[3], text);
const unchanged = Object.keys(baseline).filter(name => JSON.stringify(baseline[name]) === JSON.stringify(events[name])).length;
console.log(`${Object.keys(events).length} cases, ${Object.values(events).flat().length} events; ${unchanged} cases byte-equal to 3.0.3`);
