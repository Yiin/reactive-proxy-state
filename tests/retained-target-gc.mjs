import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { reactive, watchEffect, toRaw } = await import(pathToFileURL(resolve(process.argv[2])).href);
assert.equal(typeof globalThis.gc, "function", "run with --expose-gc");
function read(state, key) {
  if (state == null) return;
  if (state instanceof Map) return process.argv[3] === "membership" ? state.has(key) : state.get(key);
  if (state instanceof Set) return state.has(key);
  return state[key];
}
function captureSibling(state) {
  watchEffect(() => read(state, "y"));
}
function sample(kind) {
  const holder = { value: reactive(kind === 0 ? { x: 1, y: 2 } : kind === 1 ? new Map([["x", 1], ["y", 2]]) : new Set(["x", "y"])) };
  const weak = new WeakRef(toRaw(holder.value));
  const stop = watchEffect(() => read(holder.value, "x"));
  captureSibling(holder.value);
  holder.value = null;
  return { weak, stop };
}
// Bun 1.4.3 can conservatively retain a setup frame's last target even
// across later GC turns. Separate setup turns let those frames return.
// Keep the zero-retained assertion: one retained target can be a real leak.
const samples = [];
for (let index = 0; index < 30; index++) {
  await new Promise(resolve => setTimeout(() => {
    samples.push(sample(process.argv[3] === "objects" ? 0 : index % 3));
    resolve();
  }, 0));
}
for (let round = 0; round < 20; round++) {
  await new Promise(resolve => setTimeout(resolve, 5));
  globalThis.gc();
}
const retained = samples.filter(sample => sample.weak.deref() !== undefined).length;
for (const sample of samples) sample.stop();
console.log(JSON.stringify({ samples: samples.length, retained }));
assert.equal(retained, 0, "retained effect handles must not retain discarded sibling targets");
