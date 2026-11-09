/**
 * Records the events of tests/event-stream.ops.mjs from a bundle.
 * Run with: node tests/event-stream.record.mjs <bundle> <output.json> [listener-writes]
 * tests/fixtures/events-3.0.3.json and, with `listener-writes`,
 * tests/fixtures/events-listener-writes-3.0.3.json came from the
 * dist/index.js of the npm tarball of 3.0.3 (`npm pack
 * @yiin/reactive-proxy-state@3.0.3`, integrity checked against `npm view
 * ... dist.integrity`).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { recordEvents, recordListenerWrites } from "./event-stream.ops.mjs";

const [bundle, output, matrix] = process.argv.slice(2);
if (bundle === undefined || output === undefined) {
  console.error("usage: node tests/event-stream.record.mjs <bundle> <output.json> [listener-writes]");
  process.exit(2);
}
const lib = await import(pathToFileURL(resolve(bundle)).href);
const cases = matrix === "listener-writes" ? recordListenerWrites(lib) : await recordEvents(lib);
writeFileSync(output, JSON.stringify(cases, null, 1) + "\n");
console.log(`${Object.keys(cases).length} cases, ${Object.values(cases).flat().length} events`);
