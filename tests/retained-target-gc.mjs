import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { reactive, watchEffect, toRaw } = await import(pathToFileURL(resolve(process.argv[2])).href);
assert.equal(typeof globalThis.gc, "function", "run with --expose-gc");
function captureSibling(state) {
  watchEffect(() => state.y);
}
function sample() {
  const holder = { value: reactive({ x: 1, y: 2 }) };
  const weak = new WeakRef(toRaw(holder.value));
  const stop = watchEffect(() => holder.value?.x);
  captureSibling(holder.value);
  holder.value = null;
  return { weak, stop };
}
const samples = Array.from({ length: 30 }, sample);
for (let round = 0; round < 20; round++) {
  await new Promise(resolve => setTimeout(resolve, 5));
  globalThis.gc();
}
const retained = samples.filter(sample => sample.weak.deref() !== undefined).length;
for (const sample of samples) sample.stop();
console.log(JSON.stringify({ samples: samples.length, retained }));
assert.equal(retained, 0, "retained effect handles must not retain discarded sibling targets");
