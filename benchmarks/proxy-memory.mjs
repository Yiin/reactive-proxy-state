// The heap a state holds per item after a read of 200,000 items through
// reactive(): `node --expose-gc benchmarks/proxy-memory.mjs <dist/index.js> [object|array]`
// or `bun benchmarks/proxy-memory.mjs <dist/index.js> [object|array]`.
// An `object` item is {a, b:{c}} (two object proxies), an `array` item is
// {a, b:[c]} (an object proxy and an array proxy). Prints one JSON line.
import { pathToFileURL } from "node:url";

const { reactive } = await import(pathToFileURL(process.argv[2]).href);
const kind = process.argv[3] ?? "object";
const N = 200_000;
const raw = { items: [] };
for (let i = 0; i < N; i++) raw.items.push({ a: i, b: kind === "array" ? [i] : { c: i } });
const state = reactive(raw, () => {});

const jsc = typeof Bun !== "undefined" ? await import("bun:jsc") : undefined;
function used() {
  for (let i = 0; i < 6; i++) jsc ? Bun.gc(true) : globalThis.gc();
  return jsc ? jsc.heapStats().heapSize : process.memoryUsage().heapUsed;
}

const before = used();
const items = state.items;
let sum = 0;
for (let i = 0; i < N; i++) sum += kind === "array" ? items[i].b[0] : items[i].b.c;
const after = used();
console.log(JSON.stringify({ kind, bytesPerItem: +((after - before) / N).toFixed(1), checksum: sum }));
