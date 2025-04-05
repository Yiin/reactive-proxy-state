import { expect, test, describe } from "bun:test";
import { deepEqual } from '../src/index';

describe("Deep Equal Tests", () => {
  test("deepEqual handles primitives", () => {
    expect(deepEqual(42, 42)).toBe(true);
    expect(deepEqual(42, 43)).toBe(false);
    expect(deepEqual("hello", "hello")).toBe(true);
    expect(deepEqual("hello", "world")).toBe(false);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(true, false)).toBe(false);
  });

  test("deepEqual handles null and undefined", () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test("deepEqual handles arrays", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
  });

  test("deepEqual handles nested objects", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })).toBe(false);
  });

  test("deepEqual handles cycles", () => {
    const obj1: any = { a: 1 };
    obj1.self = obj1;
    const obj2: any = { a: 1 };
    obj2.self = obj2;
    const obj3: any = { a: 2 };
    obj3.self = obj3;

    expect(deepEqual(obj1, obj2)).toBe(true);
    expect(deepEqual(obj1, obj3)).toBe(false);
  });

  test("deepEqual handles Date objects", () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-01');
    const date3 = new Date('2024-01-02');

    expect(deepEqual(date1, date2)).toBe(true);
    expect(deepEqual(date1, date3)).toBe(false);
  });
}); 