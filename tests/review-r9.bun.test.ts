import { expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";

/**
 * The regressions the round 9 review found against 1.0.44: each passes on
 * the published 1.0.44 and failed on 8d0a077.
 */

for (const async of [false, true]) {
  test(`a JSON __proto__ property survives the initial replace, async=${async}`, async () => {
    const raw = JSON.parse('{"__proto__":{"n":1},"ok":0}');
    let replica: any;
    const state: any = reactive(
      raw,
      (event) => {
        if (event.path.length === 0) replica = structuredClone(event.newValue);
        else updateState(replica, structuredClone(event));
      },
      [],
      { async }
    );
    await Promise.resolve();
    state.ok = 1;
    await Promise.resolve();
    expect(Object.hasOwn(replica, "__proto__")).toBe(true);
    expect(JSON.stringify(replica)).toBe(JSON.stringify(toRaw(state)));
  });
}

test("a caught listener error does not discard a committed nested event", () => {
  const shared = { n: 0 };
  let state: any;
  let replica: any;
  let once = false;
  const paths: string[] = [];
  state = reactive({ a: shared, b: shared, c: 0 }, (event) => {
    if (event.path.length === 0) {
      replica = JSON.parse(JSON.stringify(event.newValue));
      return;
    }
    const path = event.path.join(".");
    paths.push(path);
    updateState(replica, structuredClone(event));
    if (path === "a.n" && !once) {
      once = true;
      try {
        state.c = 1;
      } catch {
        // the listener goes on
      }
    }
    if (path === "b.n") throw new Error("listener failed after applying its event");
  });
  state.a.n = 1;
  expect(paths).toContain("c");
  expect(replica).toEqual(toRaw(state));
});

test("the initial replace keeps an array's named properties", () => {
  const list: any = [1, 2];
  list.extra = { n: 3 };
  let replica: any;
  reactive({ list }, (event) => {
    replica = structuredClone(event.newValue);
  });
  expect(Object.keys(replica.list)).toEqual(Object.keys(list));
  expect(replica.list.extra).toEqual({ n: 3 });
});
