import { describe, expect, test } from "bun:test";
import { computed, reactive, toRaw, watch, watchEffect } from "../src/index";
import type { ComputedRef } from "../src/computed";
import type { StateEvent } from "../src/types";

/**
 * A write runs each effect it changed once, after every computed value it
 * made stale is stale, so an effect never reads a stale computed value.
 * 3.0.2 ran the effects of a write before the computed values two or more
 * steps away knew they were stale: an effect over `a[0]` and a computed of
 * a computed of `a` saw `[2, 4]`, then `[2, 8]`, and an effect that wrote
 * their sum to the state sent 6, then 10, to replicas.
 */

/** A chain of `depth` computed values over `source`, each doubling the one below. */
function chain(depth: number, source: () => number): ComputedRef<number> {
  let top = computed(source);
  for (let level = 1; level < depth; level++) {
    const below = top;
    top = computed(() => below.value * 2);
  }
  return top;
}

/** Sources a chain can read, and a write that changes what they read. */
const sources: Record<string, { make: () => any; read: (state: any) => number; write: (state: any, value: number) => void }> = {
  "an array map": {
    make: () => ({ list: [1, 2] }),
    read: (state) => state.list.map((value: number) => value * 2)[0],
    write: (state, value) => (state.list[0] = value),
  },
  "an object key": {
    make: () => ({ count: 1 }),
    read: (state) => state.count,
    write: (state, value) => (state.count = value),
  },
  "a Map value": {
    make: () => ({ map: new Map([["a", 1]]) }),
    read: (state) => state.map.get("a"),
    write: (state, value) => state.map.set("a", value),
  },
  "a Set size": {
    make: () => ({ set: new Set([0]) }),
    read: (state) => state.set.size,
    write: (state, value) => {
      for (let i = state.set.size; i < value; i++) state.set.add(i);
    },
  },
  "an array length after a push": {
    make: () => ({ list: [0] }),
    read: (state) => state.list.length,
    write: (state, value) => {
      while (state.list.length < value) state.list.push(state.list.length);
    },
  },
};

describe("an effect over a computed chain reads fresh values, once per write", () => {
  for (const [sourceName, source] of Object.entries(sources)) {
    for (const depth of [1, 2, 3, 4]) {
      test(`${sourceName}, chain of ${depth}`, () => {
        const state = reactive(source.make(), () => {});
        const top = chain(depth, () => source.read(state));
        const factor = 2 ** (depth - 1);
        const seen: number[][] = [];
        watchEffect(() => {
          seen.push([source.read(state), top.value]);
        });
        source.write(state, 2);
        source.write(state, 3);
        const value = (base: number) => base * factor;
        const first = source.read(reactive(source.make(), () => {}));
        expect(seen[0]).toEqual([first, value(first)]);
        // one run per write, each with the chain's fresh value
        expect(seen.length).toBe(3);
        for (const [read, derived] of seen) expect(derived).toBe(value(read));
      });
    }
  }

  test("the reported case: an effect over a[0] and a computed of a computed", () => {
    const a = reactive([1], () => {});
    const c = computed(() => a.map((x) => x * 2)[0]);
    const d = computed(() => c.value * 2);
    const seen: number[][] = [];
    watchEffect(() => {
      seen.push([a[0], d.value]);
    });
    a[0] = 2;
    expect(seen).toEqual([[1, 4], [2, 8]]);
  });

  test("two chains of different depth over one key, read by one effect", () => {
    const state = reactive({ n: 1 }, () => {});
    const short = chain(1, () => state.n);
    const long = chain(4, () => state.n);
    const seen: number[][] = [];
    watchEffect(() => seen.push([short.value, long.value]));
    state.n = 2;
    state.n = 5;
    expect(seen).toEqual([[1, 8], [2, 16], [5, 40]]);
  });

  test("a computed read by two effects and another computed is computed once per write", () => {
    const state = reactive({ n: 1 }, () => {});
    let computes = 0;
    const base = computed(() => {
      computes++;
      return state.n;
    });
    const doubled = computed(() => base.value * 2);
    watchEffect(() => base.value);
    watchEffect(() => doubled.value + base.value);
    expect(computes).toBe(1);
    state.n = 2;
    expect(computes).toBe(2);
  });
});

describe("an effect that writes a derived value sends one event per write, with the fresh value", () => {
  for (const async of [false, true]) {
    for (const depth of [1, 2, 3, 4]) {
      test(`chain of ${depth}${async ? ", async root" : ""}`, async () => {
        const events: StateEvent[] = [];
        const state = reactive(
          { list: [1], total: 0 },
          (event) => events.push(event),
          [],
          async ? { async: true } : undefined
        );
        const top = chain(depth, () => state.list.map((value) => value * 2)[0]);
        watchEffect(() => {
          state.total = state.list[0] + top.value;
        });
        const total = (base: number) => base + base * 2 ** depth;
        state.list[0] = 2;
        state.list[0] = 3;
        if (async) await Promise.resolve();
        const totals = events
          .filter((event) => event.action === "set" && event.path[0] === "total")
          .map((event) => event.newValue);
        // no stale value in between
        expect(totals).toEqual([total(1), total(2), total(3)]);
        expect(toRaw(state).total).toBe(total(3));
      });
    }
  }
});

describe("the queue", () => {
  test("an effect that waits is not queued again: it runs once after the effect that wrote", () => {
    const state = reactive({ count: 0, other: 0 }, () => {});
    let reader = 0;
    watchEffect(() => {
      state.other = state.count + 1;
    });
    watchEffect(() => {
      reader++;
      state.count;
      state.other;
    });
    reader = 0;
    state.count = 5;
    expect(reader).toBe(1);
  });

  test("an effect that already ran is queued again by a later write in the same flush", () => {
    const state = reactive({ a: 0, b: 0 }, () => {});
    const seen: number[][] = [];
    watchEffect(() => {
      seen.push([state.a, state.b]);
    });
    watchEffect(() => {
      // runs after the first effect, then writes what it read
      if (state.a > 0) state.b = state.a * 10;
    });
    seen.length = 0;
    state.a = 1;
    expect(seen).toEqual([[1, 0], [1, 10]]);
  });

  test("an effect triggered through several keys and computed values runs once", () => {
    const state = reactive({ list: [1, 2], map: new Map([["k", 1]]) }, () => {});
    const sum = computed(() => state.list.reduce((total, value) => total + value, 0));
    const deep = chain(3, () => sum.value);
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.list[0];
      state.list.length;
      state.list.map((value) => value);
      sum.value;
      deep.value;
    });
    state.list.push(3);
    expect(runs).toBe(2);
  });

  test("effects run in the order they were queued", () => {
    const state = reactive({ n: 0 }, () => {});
    const order: string[] = [];
    watchEffect(() => (state.n, order.push("a")));
    watchEffect(() => (state.n, order.push("b")));
    watchEffect(() => (state.n, order.push("c")));
    order.length = 0;
    state.n = 1;
    expect(order).toEqual(["a", "b", "c"]);
  });

  test("effects that keep writing new values to each other throw a RangeError, not a hang", () => {
    const state = reactive({ x: 0, y: 0 }, () => {});
    let looping = false;
    const stops = [
      watchEffect(() => {
        const x = state.x;
        if (looping) state.y = x + 1;
      }),
      watchEffect(() => {
        const y = state.y;
        if (looping) state.x = y + 1;
      }),
    ];
    looping = true;
    expect(() => (state.x = 1)).toThrow(RangeError);
    for (const stop of stops) stop();
    // the queue is empty again
    let runs = 0;
    watchEffect(() => (state.x, runs++));
    state.x = -1;
    expect(runs).toBe(2);
  });

  test("effects that write to each other until the values settle run to the end", () => {
    const state = reactive({ x: 0, y: 0 }, () => {});
    watchEffect(() => {
      if (state.x < 3000) state.y = state.x + 1;
    });
    watchEffect(() => {
      if (state.y < 3000) state.x = state.y + 1;
    });
    expect([state.x, state.y]).toEqual([3000, 2999]);
  });

  test("an effect that throws does not stop the others; the write throws the first error", () => {
    const state = reactive({ n: 0 }, () => {});
    const ran: string[] = [];
    watchEffect(() => {
      if (state.n === 1) throw new Error("first");
      ran.push("first");
    });
    watchEffect(() => {
      if (state.n === 1) throw new Error("second");
      ran.push("second");
    });
    watchEffect(() => {
      state.n;
      ran.push("third");
    });
    ran.length = 0;
    expect(() => (state.n = 1)).toThrow("first");
    expect(ran).toEqual(["third"]);
    state.n = 2;
    expect(ran).toEqual(["third", "first", "second", "third"]);
  });

  test("a user scheduler is called once per write and its job reads fresh computed values", () => {
    const state = reactive({ n: 1 }, () => {});
    const doubled = chain(3, () => state.n);
    const seen: number[] = [];
    const jobs: (() => void)[] = [];
    watchEffect(
      () => {
        seen.push(doubled.value);
      },
      { scheduler: (job) => jobs.push(job) }
    );
    state.n = 2;
    // the chain is stale until the job runs: a second write has nothing to tell
    state.n = 3;
    expect(jobs.length).toBe(1);
    jobs[0]();
    expect(seen).toEqual([4, 12]);
    state.n = 4;
    expect(jobs.length).toBe(2);
    jobs[1]();
    expect(seen).toEqual([4, 12, 16]);
  });

  test("a computed whose getter threw computes again on the next read", () => {
    const state = reactive({ n: 0 }, () => {});
    let fail = true;
    const value = computed(() => {
      if (fail) throw new Error("not yet");
      return state.n;
    });
    expect(() => value.value).toThrow("not yet");
    fail = false;
    expect(value.value).toBe(0);
  });

  test("a deep watch fires once per write of a computed chain's source", () => {
    const state = reactive({ list: [{ id: 1 }] }, () => {});
    const ids = chain(2, () => state.list.length);
    const calls: number[] = [];
    watch(
      // spread gives proxies, so the ids are read through them (array callbacks get raw items)
      () => [ids.value, [...state.list].map((item) => item.id)],
      (value) => calls.push(value[0] as number),
      { deep: true }
    );
    state.list.push({ id: 2 });
    state.list[0].id = 5;
    expect(calls).toEqual([4, 4]);
  });
});
