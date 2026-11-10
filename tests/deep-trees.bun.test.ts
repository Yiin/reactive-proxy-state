import { expect, test } from "bun:test";
import * as lib from "../src/index";
import { chain, runDeepChecks } from "./deep-trees.ops.mjs";

// Node runs the same checks on the bundles: tests/deep-trees.node.mjs.
for (const depth of [8000, 100000]) {
  test(`stores, copies and location walks work at depth ${depth}`, () => {
    expect(runDeepChecks(lib, depth)).toEqual([]);
  }, 60000);
}

/**
 * A text form of a value with cycles (`^n` names the ancestor n steps up),
 * holes, named array properties, own `__proto__` keys and symbol keys.
 */
function shape(value: unknown, ancestors: object[] = []): string {
  if (value === null || typeof value !== "object") return typeof value === "symbol" ? String(value) : JSON.stringify(value) ?? String(value);
  const index = ancestors.lastIndexOf(value);
  if (index >= 0) return `^${ancestors.length - index}`;
  ancestors.push(value);
  let text: string;
  if (value instanceof Date) text = `Date(${value.getTime()})`;
  else if (value instanceof Map) text = `Map{${[...value].map(([key, item]) => `${shape(key, ancestors)}=>${shape(item, ancestors)}`).join(",")}}`;
  else if (value instanceof Set) text = `Set{${[...value].map((item) => shape(item, ancestors)).join(",")}}`;
  else {
    const keys = Reflect.ownKeys(value).filter((key) => key !== "length" && Object.prototype.propertyIsEnumerable.call(value, key));
    const entries = keys.map((key) => `${String(key)}:${shape((value as any)[key], ancestors)}`);
    text = Array.isArray(value) ? `[${value.length}|${entries.join(",")}]` : `{${entries.join(",")}}`;
  }
  ancestors.pop();
  return text;
}

/** One of each kind of entry a copy handles. */
function rich(): any {
  const shared = { n: 1 };
  const list: any = [1, , { k: shared }];
  list.extra = { e: 2 };
  const value: any = JSON.parse('{"__proto__":{"p":1}}');
  value[Symbol.for("s")] = { s: 3 };
  value.map = new Map<unknown, unknown>([["a", { m: shared }], ["b", [2]]]);
  value.set = new Set<unknown>([1, { v: 4 }]);
  value.date = new Date(5);
  value.list = list;
  value.shared = shared;
  value.self = value;
  return value;
}

test("a copy deeper than the levels filled by calls is the same copy", () => {
  for (const depth of [1, 255, 256, 300, 600]) {
    const inner = rich();
    let copy: any;
    lib.reactive(chain(depth, inner), (event) => {
      copy = event.newValue;
    });
    for (let i = 0; i < depth; i++) copy = copy.child;
    // a copy has no symbol key, as JSON (3.0.19): compare it with the rest
    expect(Object.getOwnPropertySymbols(copy)).toEqual([]);
    delete inner[Symbol.for("s")];
    expect(shape(copy)).toBe(shape(inner));
    // one copy per place, and the cycle comes back to the copy itself
    expect(copy.self).toBe(copy);
    expect(copy.shared).not.toBe(copy.list[2].k);
    expect(copy.shared).not.toBe(copy.map.get("a").m);
    expect(1 in copy.list).toBe(false);
    expect(Object.hasOwn(copy, "__proto__")).toBe(true);
  }
});
