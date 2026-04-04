import { isRef } from "./ref";
import { isReactive } from "./reactive";
import { toRaw } from "./utils";

/**
 * Converts reactive proxies/refs into plain JavaScript data structures
 * so they can be safely sent across structured-clone boundaries.
 */
export function deepToRaw<T>(input: T, seen: WeakMap<any, any> = new WeakMap()): T {
  if (input === null || typeof input !== "object") {
    return input;
  }

  if (isRef(input)) {
    return deepToRaw((input as any).value, seen);
  }

  if (seen.has(input as any)) {
    return seen.get(input as any);
  }

  if (Array.isArray(input)) {
    const result: any[] = [];
    seen.set(input, result);
    for (const item of input) {
      result.push(deepToRaw(item, seen));
    }
    return result as any;
  }

  if (input instanceof Date) {
    return new Date(input.getTime()) as any;
  }

  if (input instanceof Map) {
    const result = new Map<any, any>();
    seen.set(input, result);
    for (const [key, value] of input) {
      result.set(deepToRaw(key, seen), deepToRaw(value, seen));
    }
    return result as any;
  }

  if (input instanceof Set) {
    const result = new Set<any>();
    seen.set(input, result);
    for (const value of input) {
      result.add(deepToRaw(value, seen));
    }
    return result as any;
  }

  const source: any = isReactive(input) ? toRaw(input as any) : input;

  if (seen.has(source)) {
    return seen.get(source);
  }

  if (
    source &&
    typeof source === "object" &&
    (source.constructor === Object || source.constructor === null)
  ) {
    const result = Object.create(Object.getPrototypeOf(source));
    seen.set(input as any, result);
    seen.set(source, result);
    for (const key of Reflect.ownKeys(source)) {
      result[key as any] = deepToRaw((source as any)[key], seen);
    }
    return result;
  }

  return source;
}
