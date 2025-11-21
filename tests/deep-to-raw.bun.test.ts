import { describe, expect, test } from "bun:test";
import { deepToRaw, reactive, ref } from "../src/index";

describe("deepToRaw", () => {
  test("unwraps reactive objects, arrays, and refs", () => {
    const state = reactive({
      nested: ref({ count: 1 }),
      items: [ref(2)],
    });

    state.items.push(3);
    const raw = deepToRaw(state);

    expect(raw).toEqual({
      nested: { count: 1 },
      items: [2, 3],
    });
    expect(raw).not.toBe(state);
  });

  test("handles maps and sets with nested reactive values", () => {
    const state = reactive({
      map: new Map([["a", reactive({ value: 1 })]]),
      set: new Set([ref("x")]),
    });

    const raw = deepToRaw(state);

    expect(raw.map instanceof Map).toBe(true);
    expect(raw.map.get("a")).toEqual({ value: 1 });
    expect(raw.set instanceof Set).toBe(true);
    expect(raw.set.has("x")).toBe(true);
  });

  test("preserves circular references without infinite recursion", () => {
    const obj: any = { name: "root" };
    obj.self = obj;
    const state = reactive(obj);

    const raw = deepToRaw(state) as any;
    expect(raw.self).toBe(raw);
  });
});
