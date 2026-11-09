import { describe, expect, test } from "bun:test";
import { reactive, watch, watchEffect } from "../src/index";

/**
 * A key added to or deleted from a plain object reruns every effect that
 * read a key of that object, once. Until 3.0.2 it reran only the readers
 * of that one key, so `JSON.stringify(state.obj)`, spread, `Object.entries`,
 * `Object.values` and a deep `watch` missed added keys.
 *
 * There is no `ownKeys` or `has` trap: it made `JSON.stringify` of state
 * 35% and `Object.keys` 85% slower for every caller. So an effect that read
 * no key of the object (`Object.keys`, `in`, `Object.hasOwn`, a `for...in`
 * of keys, a spread of an object with no keys) does not rerun.
 */

type Obj = { a?: number; b?: { c: number; d?: number }; z?: number };

const readers: Record<string, (obj: Obj) => unknown> = {
  "a key": (obj) => obj.a,
  "JSON.stringify": (obj) => JSON.stringify(obj),
  spread: (obj) => ({ ...obj }),
  "Object.entries": (obj) => Object.entries(obj),
  "Object.values": (obj) => Object.values(obj),
  "Object.assign": (obj) => Object.assign({}, obj),
  "for...in with values": (obj) => {
    const seen: unknown[] = [];
    for (const key in obj) seen.push((obj as any)[key]);
    return seen;
  },
};

const writes: Record<string, (obj: Obj) => unknown> = {
  "add of a key": (obj) => (obj.z = 1),
  delete: (obj) => delete obj.a,
  "delete of a missing key": (obj) => delete obj.z,
  "set of a held key": (obj) => (obj.a = 2),
  "set of the same value": (obj) => (obj.a = 1),
  "write below": (obj) => (obj.b!.c = 2),
  "add of a key below": (obj) => (obj.b!.d = 1),
  "replace of the object below": (obj) => (obj.b = { c: 5 }),
};

// `obj.z = undefined` for a new key is dropped, with no event, as in 3.0.2: not a key change yet
const keyChanges = ["add of a key", "delete"];

/** The writes after which each reader reruns, once. */
const rerunsAfter: Record<string, string[]> = {
  "a key": [...keyChanges, "set of a held key"],
  // reads every key below too
  "JSON.stringify": [...keyChanges, "set of a held key", "write below", "add of a key below", "replace of the object below"],
  spread: [...keyChanges, "set of a held key", "replace of the object below"],
  "Object.entries": [...keyChanges, "set of a held key", "replace of the object below"],
  "Object.values": [...keyChanges, "set of a held key", "replace of the object below"],
  "Object.assign": [...keyChanges, "set of a held key", "replace of the object below"],
  "for...in with values": [...keyChanges, "set of a held key", "replace of the object below"],
};

/** Where the object sits in the state. */
const placements: Record<string, (obj: Obj) => () => Obj> = {
  "in an object": (obj) => {
    const state = reactive({ obj }, () => {});
    return () => state.obj;
  },
  "as the root": (obj) => {
    const state = reactive(obj, () => {});
    return () => state;
  },
  "in an array": (obj) => {
    const state = reactive({ list: [{}, obj] }, () => {});
    return () => state.list[1] as Obj;
  },
  "as a Map value": (obj) => {
    const state = reactive({ map: new Map([["k", obj]]) }, () => {});
    return () => state.map.get("k")!;
  },
};

const make = (): Obj => ({ a: 1, b: { c: 1 } });

describe("an effect over a plain object reruns once after a key is added or deleted", () => {
  for (const [writeName, write] of Object.entries(writes)) {
    describe(writeName, () => {
      for (const [readerName, read] of Object.entries(readers)) {
        test(readerName, () => {
          for (const [placementName, place] of Object.entries(placements)) {
            const obj = place(make());
            let result: unknown;
            let runs = 0;
            const stop = watchEffect(() => {
              runs++;
              result = read(obj());
            });
            write(obj());
            stop();
            const expected = rerunsAfter[readerName].includes(writeName) ? 1 : 0;
            expect({ placementName, reruns: runs - 1 }).toEqual({ placementName, reruns: expected });
            // read outside the effect: proxies in the result track nothing there
            const fresh = (value: unknown) => JSON.stringify(value) ?? "undefined";
            expect({ placementName, seen: fresh(result) }).toEqual({ placementName, seen: fresh(read(obj())) });
          }
        });
      }

      test("a deep watch", () => {
        for (const [placementName, place] of Object.entries(placements)) {
          const obj = place(make());
          let calls = 0;
          const stop = watch(obj, () => calls++, { deep: true });
          write(obj());
          stop();
          const changes = !["delete of a missing key", "set of the same value"].includes(writeName);
          expect({ placementName, calls }).toEqual({ placementName, calls: changes ? 1 : 0 });
        }
      });
    });
  }
});

describe("an object with no keys", () => {
  test("JSON.stringify and a deep watch rerun after a key is added", () => {
    const state = reactive({ obj: {} as Record<string, number> }, () => {});
    let json = "";
    let calls = 0;
    watchEffect(() => {
      json = JSON.stringify(state.obj);
    });
    watch(() => state.obj, () => calls++, { deep: true });
    state.obj.x = 1;
    expect(json).toBe('{"x":1}');
    expect(calls).toBe(1);
  });

  test("a deep watch of a tree reruns after a key is added at any depth, also to an empty object", () => {
    const state = reactive({ a: { b: { c: {} as Record<string, number> } }, list: [{}] as Record<string, number>[] }, () => {});
    let calls = 0;
    watch(state, () => calls++, { deep: true });
    state.a.b.c.x = 1;
    expect(calls).toBe(1);
    state.list[0].y = 2;
    expect(calls).toBe(2);
    delete state.a.b.c.x;
    expect(calls).toBe(3);
  });

  test("a deep watch follows the values of a Map and the members of a Set", () => {
    const state = reactive({ map: new Map([["k", { n: 1 }]]), set: new Set([{ n: 1 }]) }, () => {});
    let calls = 0;
    watch(state, () => calls++, { deep: true });
    state.map.set("k", { n: 2 });
    expect(calls).toBe(1);
    state.map.get("k")!.n = 3;
    expect(calls).toBe(2);
    for (const member of state.set) member.n = 4;
    expect(calls).toBe(3);
  });
});

describe("reads that do not see key changes (no ownKeys or has trap)", () => {
  const blind: Record<string, (obj: Obj) => unknown> = {
    "Object.keys": (obj) => Object.keys(obj),
    in: (obj) => "z" in obj,
    "Object.hasOwn": (obj) => Object.hasOwn(obj, "z"),
    "for...in of keys": (obj) => {
      const keys: string[] = [];
      for (const key in obj) keys.push(key);
      return keys;
    },
  };
  for (const [name, read] of Object.entries(blind)) {
    test(`${name} alone does not rerun; with a key read it does`, () => {
      const state = reactive({ obj: make() }, () => {});
      let alone = 0;
      let withKey = 0;
      watchEffect(() => {
        alone++;
        read(state.obj);
      });
      watchEffect(() => {
        withKey++;
        read(state.obj);
        state.obj.a;
      });
      state.obj.z = 1;
      delete state.obj.z;
      expect([alone, withKey]).toEqual([1, 3]);
    });
  }
});

describe("what is not a key change", () => {
  test("a write through an inherited setter adds no key", () => {
    class Box {
      stored = 1;
      get value() {
        return this.stored;
      }
      set value(next: number) {
        this.stored = next;
      }
    }
    const state = reactive({ box: new Box() }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.box.stored;
      JSON.stringify(state.box);
    });
    state.box.value = 2;
    // the setter's write of `stored`, once
    expect(runs).toBe(2);
  });

  test("a new own key in place of an inherited one is a key change", () => {
    const state = reactive({ obj: { a: 1 } as Record<string, unknown> }, () => {});
    let json = "";
    watchEffect(() => {
      json = JSON.stringify(state.obj);
    });
    state.obj.toString = "own";
    expect(json).toBe('{"a":1,"toString":"own"}');
  });

  test("an array named property write does not rerun readers of the items", () => {
    const state = reactive({ list: [1, 2] as number[] & { label?: string } }, () => {});
    let runs = 0;
    watchEffect(() => {
      runs++;
      state.list.map((value) => value);
    });
    state.list.label = "x";
    delete state.list.label;
    expect(runs).toBe(1);
  });
});
