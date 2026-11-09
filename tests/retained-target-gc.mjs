import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { reactive, watchEffect, toRaw } = await import(pathToFileURL(resolve(process.argv[2])).href);
assert.equal(typeof globalThis.gc, "function", "run with --expose-gc");
function read(state, key) {
  if (state == null) return;
  if (state instanceof Map) {
    if (process.argv[3] === "membership") return state.has(key);
    if (process.argv[3] === "keys") return [...state.keys()];
    return state.get(key);
  }
  if (state instanceof Set) return state.has(key);
  return state[key];
}
function captureSibling(state) {
  // Two keys() readers share one dependency. Size supplies a distinct sibling
  // dependency whose callback captures the same Map.
  if (process.argv[3] === "keys" && state instanceof Map) watchEffect(() => state.size);
  else watchEffect(() => read(state, "y"));
}
function sample(kind) {
  const holder = { value: reactive(kind === 0 ? { x: 1, y: 2 } : kind === 1 ? new Map([["x", 1], ["y", 2]]) : new Set(["x", "y"])) };
  const weak = new WeakRef(toRaw(holder.value));
  const stop = watchEffect(() => read(holder.value, "x"));
  captureSibling(holder.value);
  holder.value = null;
  return { weak, stop };
}
// Finish module evaluation before setup, so its async frame cannot retain the
// last sample across collection. Each callback returns before the next phase.
const samples = [];
// JSC scans stack words conservatively. Returned setup frames can leave a
// target-shaped word behind, even across timer turns. Overwrite those slots
// with numbers before GC; keep the strict zero-retained assertion below.
function clearStack(depth, a, b, c, d, e, f, g, h) {
  if (depth === 0) return a + b + c + d + e + f + g + h;
  return clearStack(depth - 1, b, c, d, e, f, g, h, depth) + a;
}

function collect(round) {
  assert.ok(clearStack(256, 0, 1, 2, 3, 4, 5, 6, 7) > 0);
  globalThis.gc();
  if (round < 19) { setTimeout(() => collect(round + 1), 5); return; }
  const retained = samples.filter(sample => sample.weak.deref() !== undefined).length;
  for (const sample of samples) sample.stop();
  console.log(JSON.stringify({ samples: samples.length, retained }));
  assert.equal(retained, 0, "retained effect handles must not retain discarded sibling targets");
}
function setup() {
  samples.push(sample(process.argv[3] === "objects" ? 0 : samples.length % 3));
  if (samples.length < 30) setTimeout(setup, 0);
  else setTimeout(() => collect(0), 5);
}
setTimeout(setup, 0);
