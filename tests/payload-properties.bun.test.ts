import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";
import { treeText } from "./replica";

/**
 * Payload copies keep every own enumerable data property: an own
 * `__proto__` stays an own property, holes stay holes, and arrays keep their named (non-index)
 * properties where 1.0.44 sent the value itself: the initial replace, the
 * inserted `items`, a set's `value`, and what an async root removes. A `set`
 * payload (`newValue`) carries an array's items only, as 1.0.44's copy did.
 */

/** A root and a replica built from its events only, each crossing a structured-clone wire. */
function wire(raw: object, async = false) {
  const events: StateEvent[] = [];
  const result = { state: undefined as any, remote: undefined as any, events };
  result.state = reactive(
    raw,
    (event) => {
      const sent = structuredClone(event);
      events.push(sent);
      if (event.path.length === 0 && event.action === "replace") result.remote = sent.newValue;
      else updateState(result.remote, sent);
    },
    [],
    { async }
  );
  return result;
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

/** An array with a named property. */
function withName<T>(items: T[], name: string, value: unknown): T[] {
  const array: any = items;
  array[name] = value;
  return array;
}

describe("an own __proto__ property", () => {
  for (const async of [false, true]) {
    test(`survives the initial replace at every depth, async=${async}`, async () => {
      const raw = JSON.parse('{"a":{"__proto__":{"n":1}},"list":[{"__proto__":2,"k":1}],"m":{"x":{"__proto__":{"y":[1]}}}}');
      const sync = wire(raw, async);
      await settle();
      expect(Object.hasOwn(sync.remote.a, "__proto__")).toBe(true);
      expect(Object.hasOwn(sync.remote.list[0], "__proto__")).toBe(true);
      expect(Object.getPrototypeOf(sync.remote.a)).toBe(Object.prototype);
      expect(treeText(sync.remote)).toBe(treeText(raw));
    });

    test(`survives a stored value and a write through it, async=${async}`, async () => {
      const sync = wire({ x: 0, y: 0, list: [] as any[] }, async);
      await settle();
      sync.state.x = JSON.parse('{"__proto__":{"n":1},"m":{"o":2}}');
      sync.state.y = JSON.parse('{"__proto__":5}');
      sync.state.list.push(JSON.parse('{"__proto__":{"n":1}}'));
      await settle();
      sync.state.x.__proto__.n = 7;
      await settle();
      expect(Object.hasOwn(sync.remote.x, "__proto__")).toBe(true);
      expect(Object.hasOwn(sync.remote.y, "__proto__")).toBe(true);
      expect(sync.remote.x.__proto__).toEqual({ n: 7 });
      expect(treeText(sync.remote)).toBe(treeText(sync.state));
    });
  }
});

describe("an array's holes", () => {
  for (const async of [false, true]) {
    test(`stay holes in the initial replace and in later payloads, async=${async}`, async () => {
      const raw = { list: [1, , 3] as any[], rows: [[{ n: 1 }, , { n: 2 }]] as any[] };
      const sync = wire(raw, async);
      await settle();
      expect(1 in sync.remote.list).toBe(false);
      expect(treeText(sync.remote)).toBe(treeText(raw));
      sync.state.list.push([4, , 6]);
      sync.state.x = [7, , { n: 8 }];
      await settle();
      expect(1 in sync.remote.x).toBe(false);
      expect(treeText(sync.remote)).toBe(treeText(sync.state));
    });
  }
});

describe("an array's named properties", () => {
  for (const async of [false, true]) {
    test(`survive the initial replace, one copy per place, async=${async}`, async () => {
      const shared = { n: 1 };
      const list = withName([shared, 2], "extra", shared);
      const raw = { list, other: shared, nested: [withName([1], "inner", { deep: [3] })] };
      const sync = wire(raw, async);
      await settle();
      const remote = sync.remote;
      expect(remote.list.extra).toEqual({ n: 1 });
      expect(remote.list.extra).not.toBe(remote.list[0]);
      expect(remote.list.extra).not.toBe(remote.other);
      expect(remote.nested[0].inner).toEqual({ deep: [3] });
      expect(treeText(remote)).toBe(treeText(raw));
    });

    test(`survive inserted items, as in 1.0.44, async=${async}`, async () => {
      const sync = wire({ list: [0] as any[] }, async);
      await settle();
      sync.state.list.push(withName([1], "extra", { n: 1 }));
      sync.state.list.unshift(withName([2], "extra", { n: 2 }));
      sync.state.list.splice(1, 1, withName([3], "extra", { n: 3 }));
      await settle();
      const items = sync.events.filter((event) => event.items !== undefined).map((event) => event.items![0].extra);
      expect(items).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
      expect(treeText(sync.remote)).toBe(treeText(sync.state));
    });

    test(`survive a set's added value, async=${async}`, async () => {
      const sync = wire({ tags: new Set<unknown>() }, async);
      await settle();
      sync.state.tags.add(withName([1], "extra", { n: 1 }));
      await settle();
      expect(sync.events.at(-1)!.value.extra).toEqual({ n: 1 });
      expect(treeText(sync.remote)).toBe(treeText(sync.state));
    });

    test(`of the reordered array stay on the replica, async=${async}`, async () => {
      const rows = withName([[1], [2]], "top", { n: 1 });
      const sync = wire({ rows }, async);
      await settle();
      sync.state.rows.reverse();
      await settle();
      expect(sync.events.at(-1)!.action).toBe("replace");
      expect(sync.remote.rows.top).toEqual({ n: 1 });
      expect(treeText(sync.remote)).toBe(treeText(sync.state));
    });
  }

  test("survive what an async root removes", async () => {
    const removed = withName([1], "extra", { n: 1 });
    const sync = wire({ list: removed, rest: [withName([2], "extra", 2)] }, true);
    await settle();
    delete sync.state.list;
    sync.state.rest.pop();
    await settle();
    expect(sync.events.at(-2)!.oldValue.extra).toEqual({ n: 1 });
    expect(sync.events.at(-1)!.oldValue.extra).toBe(2);
  });

  test("are not in a newValue, which carries the items, as 1.0.44's copy did", () => {
    const events: StateEvent[] = [];
    const state: any = reactive({ x: 0, rows: [[1], [2]] }, (event) => events.push(event));
    const value = withName([1], "extra", { n: 1 });
    state.x = value;
    expect(Object.keys(events.at(-1)!.newValue)).toEqual(["0"]);
    expect(toRaw(state).x).toBe(value);
    withName(toRaw(state).rows[0], "extra", 1);
    state.rows.reverse();
    expect(Object.keys(events.at(-1)!.newValue[1])).toEqual(["0"]);
  });
});
