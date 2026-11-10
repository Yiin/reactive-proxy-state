import { describe, expect, test } from "bun:test";
import { heapStats } from "bun:jsc";

/**
 * What a proxy holds of its own. Until 3.0.19 each object and array proxy
 * had its own handler with four closures; since 3.0.20 the traps are shared
 * and a proxy holds three or four fields. Measured with
 * `benchmarks/proxy-memory.mjs` on Bun 1.3.9, per item of 200,000:
 *
 * | item        | 3.0.11 | 3.0.19 | 3.0.20 |
 * | ----------- | ------ | ------ | ------ |
 * | {a, b:{c}}  | 1289 B | 1481 B | 1001 B |
 * | {a, b:[c]}  | 1443 B | 1603 B | 1107 B |
 *
 * The bounds sit below 3.0.11 and well above 3.0.20, so engine changes do
 * not trip them, and a per-proxy closure (about 60 B a proxy) or a context
 * does.
 */
const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const { reactive } = lib;

function heapSize(): number {
  for (let i = 0; i < 6; i++) Bun.gc(true);
  return heapStats().heapSize;
}

/** Heap per item that reading `count` items of `make(i)` through a root holds. */
function bytesPerItem(count: number, make: (i: number) => object, read: (item: any) => number): number {
  const raw = { items: [] as object[] };
  for (let i = 0; i < count; i++) raw.items.push(make(i));
  const state = reactive(raw, () => {});
  const before = heapSize();
  const items = state.items;
  let sum = 0;
  for (let i = 0; i < count; i++) sum += read(items[i]);
  const after = heapSize();
  expect(sum).toBe((count * (count - 1)) / 2);
  return (after - before) / count;
}

describe("the heap a read holds per proxy", () => {
  test("an item with a nested object holds less than in 3.0.11", () => {
    const perItem = bytesPerItem(100_000, (i) => ({ a: i, b: { c: i } }), (item) => item.b.c);
    expect(perItem).toBeLessThan(1200);
  });

  test("an item with a nested array holds less than in 3.0.11", () => {
    const perItem = bytesPerItem(100_000, (i) => ({ a: i, b: [i] }), (item) => item.b[0]);
    expect(perItem).toBeLessThan(1330);
  });
});
