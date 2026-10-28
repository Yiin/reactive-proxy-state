import { describe, expect, test } from "bun:test";
import { toRaw } from "../src/index";
import { replicate } from "./replica";

/**
 * A structural change of an array relinks its items from the changed index
 * on, and stops once it met every place the array held: the items after
 * that have no node, so nothing below them can emit.
 */

describe("a relink that stops early", () => {
  test("an item at two indexes keeps both after an unshift", () => {
    const sync = replicate({ list: [{ n: 0 }, { n: 1 }] as any[] });
    sync.state.list[1] = sync.state.list[0];
    const item = sync.state.list[0];
    sync.state.list.unshift({ n: 9 });
    sync.clear();
    item.n = 5;
    expect(sync.paths()).toEqual(["set:list.1.n", "set:list.2.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("an item read once moves with each unshift, and the cap drops it", () => {
    const sync = replicate({ history: Array.from({ length: 5 }, (_, at) => ({ at })) });
    const first = sync.state.history[0];
    for (let i = 0; i < 4; i++) {
      sync.state.history.unshift({ at: 100 + i });
      sync.state.history.length = 5;
    }
    sync.clear();
    first.at = -1;
    expect(sync.paths()).toEqual(["set:history.4.at"]);
    sync.state.history.unshift({ at: 200 });
    sync.state.history.length = 5;
    expect(toRaw(sync.state).history.includes(toRaw(first))).toBe(false);
    sync.clear();
    first.at = -2;
    expect(sync.paths()).toEqual([]);
    sync.state.history[0].at = 7;
    expect(sync.inSync()).toBe(true);
  });

  test("a shift of an item that sits at two indexes keeps the other one", () => {
    const sync = replicate({ list: [{ n: 0 }, { n: 1 }, { n: 2 }] as any[] });
    sync.state.list[2] = sync.state.list[0];
    const item = sync.state.list[0];
    sync.state.list.shift();
    sync.clear();
    item.n = 5;
    expect(sync.paths()).toEqual(["set:list.1.n"]);
    expect(sync.inSync()).toBe(true);
  });

  test("items read after the first one still move", () => {
    const sync = replicate({ list: Array.from({ length: 6 }, (_, n) => ({ n })) });
    const read = [sync.state.list[1], sync.state.list[4]];
    sync.state.list.splice(0, 0, { n: 10 }, { n: 11 });
    // removes the unread item 0, now at index 2
    sync.state.list.splice(2, 1);
    sync.clear();
    read[0].n = -1;
    read[1].n = -4;
    expect(sync.paths()).toEqual(["set:list.2.n", "set:list.5.n"]);
    expect(sync.inSync()).toBe(true);
  });
});
