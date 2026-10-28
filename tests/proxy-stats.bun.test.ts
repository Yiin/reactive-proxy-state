import { beforeEach, describe, expect, test } from "bun:test";
import { getProxyStats, reactive, resetProxyStats } from "../src/index";

/**
 * A write that lands on an object with no place under a root emits nothing.
 * `detachedWrites` counts those writes, so a consumer can alert on them.
 */

describe("proxy stats", () => {
  beforeEach(() => resetProxyStats());

  test("the stats keep their public shape", () => {
    const stats = getProxyStats();
    expect(stats.pathConcatCacheSize).toBe(0);
    expect(stats.detachedWrites).toBe(0);
    for (const key of ["created", "arrays", "maps", "sets", "objects", "staleEvicted"]) {
      expect(typeof (stats as any)[key]).toBe("number");
    }
  });

  test("a write through a removed object counts once", () => {
    const state: any = reactive({ list: [{ n: 0 }, { n: 1 }], map: new Map([["a", { n: 0 }]]) }, () => {});
    const removed = state.list[0];
    const removedValue = state.map.get("a");
    state.list.shift();
    state.map.delete("a");
    expect(getProxyStats().detachedWrites).toBe(0);

    removed.n = 5;
    expect(getProxyStats().detachedWrites).toBe(1);
    removedValue.n = 5;
    expect(getProxyStats().detachedWrites).toBe(2);

    const removedList = state.list;
    state.list = [];
    removedList.length = 5; // one write, several index events
    expect(getProxyStats().detachedWrites).toBe(3);
  });

  test("writes under a root do not count, with or without an emit function", () => {
    const state: any = reactive({ list: [{ n: 0 }] }, () => {});
    state.list[0].n = 1;
    state.list.push({ n: 2 });
    const silent: any = reactive({ a: { n: 0 } });
    silent.a.n = 1;
    expect(getProxyStats().detachedWrites).toBe(0);
  });

  test("resetProxyStats clears the counter", () => {
    const state: any = reactive({ a: { n: 0 } }, () => {});
    const a = state.a;
    state.a = null;
    a.n = 1;
    expect(getProxyStats().detachedWrites).toBe(1);
    resetProxyStats();
    expect(getProxyStats().detachedWrites).toBe(0);
  });
});
