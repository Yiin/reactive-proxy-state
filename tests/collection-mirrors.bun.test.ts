import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import type { StateEvent } from "../src/types";

/**
 * A member's token is unique inside the collection that holds it. A copy
 * that a replica holds stands for the member it was copied from, so a
 * reactive root made on a replica, whose events go back to the source in
 * the same realm, names its members the way the source does: the two sides
 * converge, and each write gives its events once. A copy and its original
 * in one collection stay two members, whichever came first.
 */

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Members of a Set (or keys of a Map) as text, in order. */
function text(collection: Set<any> | Map<any, any>): string[] {
  const raw = toRaw(collection);
  if (raw instanceof Map) return [...raw].map(([key, value]) => JSON.stringify([toRaw(key), toRaw(value)]));
  return [...raw].map((member) => JSON.stringify(toRaw(member)));
}

/**
 * A source root S, and a root B made on S's replica. S's events go to B and
 * B's events go back to S, both through `updateState`. With `mute`, S drops
 * its own events while it applies one of B's (the echo).
 */
async function bidirectional(async: boolean, mute: boolean, cap = Infinity) {
  let replica: any;
  let applyingFromB = false;
  const events = { S: [] as StateEvent[], B: [] as StateEvent[] };
  const options = async ? { async: true } : undefined;
  let B: any;
  const S: any = reactive(
    { s: new Set<object>(), m: new Map<object, number>() },
    (event) => {
      if (event.action === "replace" && event.path.length === 0) {
        replica = event.newValue;
        return;
      }
      events.S.push(event);
      if (events.S.length + events.B.length > cap) return;
      if (mute && applyingFromB) return;
      updateState(B, event);
    },
    [],
    options
  );
  await tick();
  B = reactive(
    replica,
    (event) => {
      if (event.action === "replace" && event.path.length === 0) return;
      events.B.push(event);
      if (events.S.length + events.B.length > cap) return;
      applyingFromB = true;
      try {
        updateState(S, event);
      } finally {
        applyingFromB = false;
      }
    },
    [],
    options
  );
  /** Events since the last call, per root. */
  let seenS = 0;
  let seenB = 0;
  const fresh = () => {
    const counts = { S: events.S.length - seenS, B: events.B.length - seenB };
    seenS = events.S.length;
    seenB = events.B.length;
    return counts;
  };
  return { S, B, events, fresh };
}

describe("a root on a replica whose events go back to the source", () => {
  test("S adds, B deletes (sync, echo muted)", async () => {
    const { S, B, fresh } = await bidirectional(false, true);
    S.s.add({ id: 1 });
    await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(text(B.s)).toEqual(text(S.s));
    B.s.delete([...toRaw(B).s][0]);
    await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(0);
    expect(toRaw(B).s.size).toBe(0);
  });

  test("B adds, S deletes (sync, echo muted)", async () => {
    const { S, B, fresh } = await bidirectional(false, true);
    B.s.add({ id: 7 });
    await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(text(S.s)).toEqual(text(B.s));
    expect(toRaw(S).s.size).toBe(1);
    S.s.delete([...toRaw(S).s][0]);
    await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(0);
    expect(toRaw(B).s.size).toBe(0);
  });

  test("B adds, then deletes (sync, nothing muted)", async () => {
    const { S, B, fresh } = await bidirectional(false, false);
    B.s.add({ id: 7 });
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(1);
    expect(toRaw(B).s.size).toBe(1);
    expect(text(S.s)).toEqual(text(B.s));
    B.s.delete([...toRaw(B).s][0]);
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(0);
    expect(toRaw(B).s.size).toBe(0);
  });

  test("S adds, then deletes (async roots, nothing muted)", async () => {
    const { S, B, fresh } = await bidirectional(true, false, 50);
    S.s.add({ id: 1 });
    for (let i = 0; i < 5; i++) await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(1);
    expect(toRaw(B).s.size).toBe(1);
    expect(text(S.s)).toEqual(text(B.s));
    S.s.delete([...toRaw(S).s][0]);
    for (let i = 0; i < 5; i++) await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(0);
    expect(toRaw(B).s.size).toBe(0);
  });

  test("B adds, then S deletes (async roots, nothing muted)", async () => {
    const { S, B, fresh } = await bidirectional(true, false, 50);
    B.s.add({ id: 7 });
    for (let i = 0; i < 5; i++) await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(text(S.s)).toEqual(text(B.s));
    S.s.delete([...toRaw(S).s][0]);
    for (let i = 0; i < 5; i++) await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect(toRaw(S).s.size).toBe(0);
    expect(toRaw(B).s.size).toBe(0);
  });

  test("Map keys: B sets and deletes (sync, echo muted)", async () => {
    const { S, B, fresh } = await bidirectional(false, true);
    S.m.set({ k: 1 }, 1);
    await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    const key = [...toRaw(B).m.keys()][0];
    B.m.set(key, 2);
    await tick();
    expect(fresh()).toEqual({ S: 1, B: 1 });
    expect([...toRaw(S).m.values()]).toEqual([2]);
    B.m.delete(key);
    await tick();
    expect(toRaw(S).m.size).toBe(0);
    expect(toRaw(B).m.size).toBe(0);
  });

  for (const [async, mute] of [
    [false, true],
    [false, false],
    [true, false],
  ] as const) {
    const mode = `${async ? "async" : "sync"}${mute ? ", echo muted" : ""}`;
    const settle = async () => {
      for (let i = 0; i < 4; i++) await tick();
    };

    test(`B's member put into S next to its original (${mode})`, async () => {
      const { S, B, events } = await bidirectional(async, mute, 100);
      const original = { id: 1 };
      S.s.add(original);
      await settle();
      const mirrored = [...toRaw(B).s][0];
      S.s.add(mirrored);
      await settle();
      expect(toRaw(S).s.size).toBe(2);
      expect(toRaw(B).s.size).toBe(2);
      S.s.delete(mirrored);
      await settle();
      expect(toRaw(S).s.size).toBe(1);
      expect(toRaw(B).s.size).toBe(1);
      S.s.delete(original);
      await settle();
      expect(toRaw(B).s.size).toBe(0);
      expect(events.S.length + events.B.length).toBeLessThan(20);
    });

    test(`B adds an object equal to a member S holds, then deletes it (${mode})`, async () => {
      const { S, B, events } = await bidirectional(async, mute, 100);
      S.s.add({ id: 1 });
      await settle();
      const twin = { id: 1 };
      B.s.add(twin);
      await settle();
      expect(toRaw(S).s.size).toBe(2);
      expect(toRaw(B).s.size).toBe(2);
      B.s.delete(twin);
      await settle();
      expect(toRaw(S).s.size).toBe(1);
      expect(toRaw(B).s.size).toBe(1);
      expect(events.S.length + events.B.length).toBeLessThan(20);
    });

    test(`a member deleted and added again on each side (${mode})`, async () => {
      const { S, B, events } = await bidirectional(async, mute, 100);
      const original = { id: 1 };
      S.s.add(original);
      await settle();
      const mirrored = [...toRaw(B).s][0];
      B.s.delete(mirrored);
      await settle();
      B.s.add(mirrored);
      await settle();
      expect(toRaw(S).s.size).toBe(1);
      expect(toRaw(B).s.size).toBe(1);
      S.s.delete([...toRaw(S).s][0]);
      await settle();
      expect(toRaw(B).s.size).toBe(0);
      S.s.add(original);
      await settle();
      expect(toRaw(B).s.size).toBe(1);
      expect(text(B.s)).toEqual(text(S.s));
      expect(events.S.length + events.B.length).toBeLessThan(30);
    });
  }

  test("a Set that B assigns, then a member B deletes (sync, echo muted)", async () => {
    const { S, B } = await bidirectional(false, true);
    B.x = new Set([{ id: 1 }, { id: 2 }]);
    B.x.delete([...toRaw(B).x][0]);
    expect(text(S.x)).toEqual(text(B.x));
    S.x.delete([...toRaw(S).x][0]);
    expect(toRaw(B).x.size).toBe(0);
  });

  test("a chain of three roots, each on the replica of the one before, writing back", () => {
    let first: any;
    let second: any;
    let fromS = false;
    let fromB = false;
    let fromC = false;
    let B: any;
    let C: any;
    const S: any = reactive({ s: new Set([{ id: 1 }, { id: 2 }]) }, (event) => {
      if (event.action === "replace" && event.path.length === 0) first = event.newValue;
      else if (!fromB) {
        fromS = true;
        try {
          updateState(B, event);
        } finally {
          fromS = false;
        }
      }
    });
    B = reactive(first, (event) => {
      if (event.action === "replace" && event.path.length === 0) {
        second = event.newValue;
        return;
      }
      if (!fromS) {
        fromB = true;
        try {
          updateState(S, event);
        } finally {
          fromB = false;
        }
      }
      if (!fromC && C !== undefined) {
        const outer = fromB;
        fromB = true;
        try {
          updateState(C, event);
        } finally {
          fromB = outer;
        }
      }
    });
    C = reactive(second, (event) => {
      if (event.action === "replace" && event.path.length === 0) return;
      if (fromB) return;
      fromC = true;
      try {
        updateState(B, event);
      } finally {
        fromC = false;
      }
    });
    C.s.delete([...toRaw(C).s][0]);
    expect([toRaw(S).s.size, toRaw(B).s.size, toRaw(C).s.size]).toEqual([1, 1, 1]);
    S.s.add({ id: 3 });
    expect([toRaw(S).s.size, toRaw(B).s.size, toRaw(C).s.size]).toEqual([2, 2, 2]);
    C.s.delete([...toRaw(C).s].find((member: any) => member.id === 3));
    expect([toRaw(S).s.size, toRaw(B).s.size, toRaw(C).s.size]).toEqual([1, 1, 1]);
    expect(text(S.s)).toEqual(text(C.s));
  });

  test("a root made on a replica that already holds members deletes one of them", async () => {
    let replica: any;
    let applyingFromB = false;
    const first = { id: 1 };
    const second = { id: 2 };
    let B: any;
    const S: any = reactive({ s: new Set([first, second]) }, (event) => {
      if (event.action === "replace" && event.path.length === 0) {
        replica = event.newValue;
        return;
      }
      if (!applyingFromB) updateState(B, event);
    });
    B = reactive(replica, (event) => {
      if (event.action === "replace" && event.path.length === 0) return;
      applyingFromB = true;
      try {
        updateState(S, event);
      } finally {
        applyingFromB = false;
      }
    });
    B.s.delete([...toRaw(B).s][1]);
    expect(text(S.s)).toEqual([JSON.stringify(first)]);
    expect(text(B.s)).toEqual(text(S.s));
    S.s.delete(first);
    expect(toRaw(B).s.size).toBe(0);
  });
});

/** A root and a replica built from its initial replace, fed by its events. */
function mirror<T extends object>(initial: T) {
  let replica: any;
  const state: any = reactive(initial, (event) => {
    if (event.action === "replace" && event.path.length === 0) replica = event.newValue;
    else updateState(replica, event);
  });
  return { state, replica: () => replica };
}

describe("a copy and its original in one collection, the copy first", () => {
  test("added one after the other", () => {
    const original = { id: 1 };
    const sync = mirror({ s: new Set([original]), t: new Set<object>() });
    const copy = [...sync.replica().s][0];
    sync.state.t.add(copy);
    sync.state.t.add(original);
    expect(toRaw(sync.state.t).size).toBe(2);
    expect(sync.replica().t.size).toBe(2);
    expect(text(sync.replica().t)).toEqual(text(sync.state.t));
    sync.state.s.delete(original);
    expect(sync.replica().s.size).toBe(0);
    sync.state.t.delete(original);
    expect(text(sync.replica().t)).toEqual(text(sync.state.t));
    expect([...sync.replica().t][0]).not.toBe(copy);
    sync.state.t.delete(copy);
    expect(sync.replica().t.size).toBe(0);
  });

  test("the copy stored with a new Set, the original added later", () => {
    const original = { id: 1 };
    const sync = mirror({ s: new Set([original]), t: null as Set<object> | null });
    const copy = [...sync.replica().s][0];
    sync.state.t = new Set([copy]);
    sync.state.t.add(original);
    expect(sync.replica().t.size).toBe(2);
    expect(text(sync.replica().t)).toEqual(text(sync.state.t));
    sync.state.t.delete(original);
    expect(sync.replica().t.size).toBe(1);
    sync.state.s.delete(original);
    expect(sync.replica().s.size).toBe(0);
    sync.state.t.delete(copy);
    expect(sync.replica().t.size).toBe(0);
  });

  test("the copy in the initial state of a root, the original added later", () => {
    const original = { id: 1 };
    const first = mirror({ s: new Set([original]) });
    const copy = [...first.replica().s][0];
    const sync = mirror({ t: new Set([copy]) });
    sync.state.t.add(original);
    expect(sync.replica().t.size).toBe(2);
    sync.state.t.delete(original);
    expect(sync.replica().t.size).toBe(1);
    sync.state.t.add(original);
    sync.state.t.delete(copy);
    expect(sync.replica().t.size).toBe(1);
    sync.state.t.delete(original);
    expect(sync.replica().t.size).toBe(0);
  });

  test("Map keys: the copy set first, the original later", () => {
    const original = { k: 1 };
    const sync = mirror({ m: new Map([[original, "a"]]), n: new Map<object, string>() });
    const copy = [...sync.replica().m.keys()][0];
    sync.state.n.set(copy, "copy");
    sync.state.n.set(original, "original");
    expect(sync.replica().n.size).toBe(2);
    sync.state.n.set(original, "again");
    expect(text(sync.replica().n)).toEqual(text(sync.state.n));
    sync.state.n.delete(original);
    expect(text(sync.replica().n)).toEqual(text(sync.state.n));
    sync.state.m.delete(original);
    expect(sync.replica().m.size).toBe(0);
    sync.state.n.delete(copy);
    expect(sync.replica().n.size).toBe(0);
  });

  test("a mirror's copy first, then the source's original in the mirror", async () => {
    const { S, B } = await bidirectional(false, true);
    const original = { id: 1 };
    S.s.add(original);
    await tick();
    B.s.add(original);
    await tick();
    expect(toRaw(B).s.size).toBe(2);
    expect(toRaw(S).s.size).toBe(2);
    expect(text(S.s)).toEqual(text(B.s));
    B.s.delete(original);
    await tick();
    expect(toRaw(B).s.size).toBe(1);
    expect(toRaw(S).s.size).toBe(1);
    S.s.delete(original);
    await tick();
    expect(toRaw(B).s.size).toBe(0);
    expect(toRaw(S).s.size).toBe(0);
  });
});

describe("a Set that holds a proxy and its raw object", () => {
  test("the replica keeps one member for both, as the state does", () => {
    const sync = mirror({ a: { x: 1 }, s: null as Set<object> | null });
    sync.state.s = new Set([sync.state.a, toRaw(sync.state).a, { y: 2 }]);
    expect(toRaw(sync.state).s.size).toBe(2);
    expect(text(sync.replica().s)).toEqual(text(sync.state.s));
  });

  test("the raw object first, then its proxy", () => {
    const sync = mirror({ a: { x: 1 }, s: null as Set<object> | null });
    sync.state.s = new Set([{ y: 0 }, toRaw(sync.state).a, sync.state.a, { y: 2 }]);
    expect(toRaw(sync.state).s.size).toBe(3);
    expect(text(sync.replica().s)).toEqual(text(sync.state.s));
    sync.state.s.delete(toRaw(sync.state).a);
    expect(text(sync.replica().s)).toEqual(text(sync.state.s));
  });

  test("a proxy of another root and its raw object", () => {
    const donor = reactive({ d: { x: 1 } });
    const sync = mirror({ s: null as Set<object> | null });
    sync.state.s = new Set([donor.d, { y: 1 }, toRaw(donor).d]);
    expect(toRaw(sync.state).s.size).toBe(2);
    expect(text(sync.replica().s)).toEqual(text(sync.state.s));
  });
});
