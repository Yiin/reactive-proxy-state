// Keys written through one long-lived outer proxy are not kept by the
// state (3.0.16 remembered each one per receiver, never pruned). Run with:
// node --expose-gc tests/receiver-keys-gc.mjs <bundle> strings|symbols
// strings: 200,000 keys added, written and deleted through one membrane
// leave the heap within 2 MB of where it started. symbols: 200 symbol keys
// written through an outer proxy and deleted are all finalized.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { reactive } = await import(pathToFileURL(resolve(process.argv[2])).href);
assert.equal(typeof globalThis.gc, "function", "run with --expose-gc");
const mode = process.argv[3];
const state = reactive({ dict: { a: 1 } }, () => {});
const membrane = new Proxy(state.dict, {
  getPrototypeOf: () => null,
  getOwnPropertyDescriptor(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    return descriptor && { ...descriptor };
  },
});
const settle = async () => {
  for (let round = 0; round < 10; round++) {
    await new Promise((resolve) => setTimeout(resolve, 2));
    globalThis.gc();
  }
};
if (mode === "strings") {
  const churn = (from, to) => {
    for (let i = from; i < to; i++) {
      const key = `key${i}`;
      membrane[key] = i;
      membrane[key] = i + 1;
      delete membrane[key];
    }
  };
  churn(0, 20_000);
  await settle();
  const before = process.memoryUsage().heapUsed;
  churn(20_000, 220_000);
  await settle();
  const grownMb = (process.memoryUsage().heapUsed - before) / 2 ** 20;
  console.log(JSON.stringify({ mode, keys: 200_000, grownMb: Math.round(grownMb * 10) / 10 }));
  assert.ok(grownMb < 2, `the heap grew by ${grownMb} MB`);
} else if (mode === "symbols") {
  let finalized = 0;
  const registry = new FinalizationRegistry(() => finalized++);
  const outer = new Proxy(state.dict, {});
  await new Promise((resolve) =>
    setTimeout(() => {
      for (let i = 0; i < 200; i++) {
        const key = Symbol(`key${i}`);
        registry.register(key, i);
        outer[key] = i;
        outer[key] = i + 1;
        delete outer[key];
      }
      resolve();
    }, 0)
  );
  await settle();
  await settle();
  console.log(JSON.stringify({ mode, keys: 200, finalized }));
  // V8 may keep the last one alive through a stale stack slot
  assert.ok(finalized >= 199, `${finalized} of 200 symbol keys finalized`);
  assert.equal(outer.a, 1);
} else {
  throw new Error(`unknown mode ${mode}`);
}
