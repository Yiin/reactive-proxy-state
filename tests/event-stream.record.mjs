/**
 * Records the events of tests/event-stream.ops.mjs from a bundle.
 * Run with: node tests/event-stream.record.mjs <bundle> <output.json>
 * tests/fixtures/events-3.0.2.json came from the dist/index.js of the npm
 * tarball of 3.0.2 (`npm pack @yiin/reactive-proxy-state@3.0.2`, integrity
 * checked against `npm view ... dist.integrity`).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { recordEvents } from "./event-stream.ops.mjs";

const [bundle, output] = process.argv.slice(2);
if (bundle === undefined || output === undefined) {
  console.error("usage: node tests/event-stream.record.mjs <bundle> <output.json>");
  process.exit(2);
}
const lib = await import(pathToFileURL(resolve(bundle)).href);
const cases = await recordEvents(lib);
writeFileSync(output, JSON.stringify(cases, null, 1) + "\n");
console.log(`${Object.keys(cases).length} cases, ${Object.values(cases).flat().length} events`);
