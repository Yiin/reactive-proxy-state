import { describe, expect, test } from "bun:test";
import type * as Library from "../src/index";

const { reactive, toRaw } = (await import(process.env.RPS_TEST_BUNDLE ?? "../src/index")) as typeof Library;

/**
 * The proxies cache their wrapped methods in an object whose prototype has
 * no prototype (3.0.11). A read finds only the methods put in it, so every
 * name of Object.prototype still reads what the collection gives, before and
 * after the cache holds methods, and on a second read from the cache.
 */
const objectNames = [...Object.getOwnPropertyNames(Object.prototype), "__proto__"];

const collections = {
  array: () => [1, 2, 3],
  Map: () => new Map([["a", 1]]),
  Set: () => new Set([1, 2]),
};

/** Methods each collection's proxy caches when they are read. */
const cachedMethods: Record<keyof typeof collections, PropertyKey[]> = {
  array: ["map", "push", "find", "at", Symbol.iterator, "values", "keys", "entries", "slice"],
  Map: ["get", "set", "has", "delete", Symbol.iterator, "values", "forEach"],
  Set: ["add", "has", "delete", Symbol.iterator, "values", "forEach", "union"],
};

describe("Object.prototype names read through a proxy are the collection's", () => {
  for (const [kind, make] of Object.entries(collections) as [keyof typeof collections, () => any][]) {
    for (const warm of [false, true]) {
      test(`${kind}, ${warm ? "after" : "before"} methods are cached`, () => {
        const state = reactive({ value: make() }, () => {});
        const proxy = state.value;
        const raw = toRaw(proxy);
        if (warm) for (const name of cachedMethods[kind]) proxy[name];
        for (const name of objectNames) {
          for (let read = 0; read < 2; read++) {
            expect([name, typeof proxy[name]]).toEqual([name, typeof raw[name]]);
          }
        }
        expect(proxy.constructor).toBe(raw.constructor);
        expect(proxy.__proto__).toBe(Object.getPrototypeOf(raw));
        expect(proxy.valueOf()).toBe(proxy);
        expect(proxy.toString()).toBe(raw.toString());
        expect(proxy.toLocaleString()).toBe(raw.toLocaleString());
        expect(proxy.hasOwnProperty("0")).toBe(raw.hasOwnProperty("0"));
        expect(proxy.hasOwnProperty("get")).toBe(false);
        expect(proxy.propertyIsEnumerable("0")).toBe(raw.propertyIsEnumerable("0"));
        expect(proxy.isPrototypeOf(raw)).toBe(false);
        expect(Object.prototype.toString.call(proxy)).toBe(Object.prototype.toString.call(raw));
      });
    }
  }

  test("the cached methods still work after Object.prototype names were read", () => {
    const state = reactive({ list: [1, 2], map: new Map([["a", 1]]), set: new Set([1]) }, () => {});
    for (const name of objectNames) {
      (state.list as any)[name];
      (state.map as any)[name];
      (state.set as any)[name];
    }
    expect([...state.list]).toEqual([1, 2]);
    expect(state.list.map((x) => x * 2)).toEqual([2, 4]);
    expect(state.map.get("a")).toBe(1);
    expect(state.set.has(1)).toBe(true);
    expect(`${state.list}`).toBe("1,2");
  });
});
