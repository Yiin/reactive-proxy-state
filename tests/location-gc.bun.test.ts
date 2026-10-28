import { describe, expect, test } from "bun:test";
import { reactive, toRaw } from "../src/index";

/**
 * Location records must not keep removed containers alive. A child's place
 * names its parent weakly: a removed parent, an abandoned root and the
 * containers around a removed object all go when nothing else holds them.
 */

async function collectGarbage() {
  for (let round = 0; round < 8; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    Bun.gc(true);
  }
}

const alive = (refs: WeakRef<object>[]) => refs.filter((ref) => ref.deref() !== undefined).length;

describe("location records and garbage collection", () => {
  test("removed parents that share a surviving child are collected", async () => {
    function setup() {
      const child = { n: 0 };
      const state: any = reactive(
        { keep: child, parents: Array.from({ length: 200 }, (_, i) => ({ child, payload: new Uint8Array(1000), i })) },
        () => {}
      );
      void state.keep.n;
      const refs: WeakRef<object>[] = [];
      for (let i = 0; i < 200; i++) {
        const parent = state.parents[i];
        void parent.child.n;
        refs.push(new WeakRef(toRaw(parent)));
      }
      state.parents.length = 0;
      return { state, refs };
    }
    const { state, refs } = setup();
    await collectGarbage();
    expect(alive(refs)).toBe(0);
    expect(state.keep.n).toBe(0);
  });

  test("abandoned roots that share a child with a live root are collected", async () => {
    function setup() {
      const child = { n: 0 };
      const live: any = reactive({ child }, () => {});
      void live.child.n;
      const refs: WeakRef<object>[] = [];
      for (let i = 0; i < 200; i++) {
        const temporary: any = reactive({ child, payload: new Uint8Array(1000) }, () => {});
        void temporary.child.n;
        refs.push(new WeakRef(toRaw(temporary)));
      }
      return { live, refs };
    }
    const { live, refs } = setup();
    await collectGarbage();
    expect(alive(refs)).toBe(0);
    live.child.n = 1;
    expect(live.child.n).toBe(1);
  });

  test("a held proxy of a removed object pins no later generation of its list", async () => {
    let nextId = 0;
    const job = () => ({ id: nextId++, runHistory: Array.from({ length: 5 }, (_, at) => ({ at })) });
    const state: any = reactive({ jobs: Array.from({ length: 20 }, job) }, () => {});
    const replacedLists: WeakRef<object>[] = [];

    function churn(times: number) {
      for (let i = 0; i < times; i++) {
        const jobs = state.jobs;
        void jobs[0].runHistory[0].at;
        void jobs[10].runHistory[0].at;
        const victim = jobs[0].id;
        replacedLists.push(new WeakRef(toRaw(jobs)));
        state.jobs = jobs.filter((entry: any) => entry.id !== victim);
        state.jobs.push(job());
      }
    }

    churn(5);
    const kept = state.jobs[0].runHistory[0];
    const keptId = state.jobs[0].id;
    replacedLists.push(new WeakRef(toRaw(state.jobs)));
    state.jobs = state.jobs.filter((entry: any) => entry.id !== keptId);
    churn(200);

    await collectGarbage();
    expect(alive(replacedLists)).toBe(0);
    expect(kept.at).toBe(0);
  });

  test("a held grandchild of a list replaced by a filter does not pin the old list", async () => {
    const refs: WeakRef<object>[] = [];
    const kept: any[] = [];
    function setup() {
      const state: any = reactive(
        { list: Array.from({ length: 4 }, (_, id) => ({ id, data: [{ i: 0 }, { i: 1 }] })) },
        () => {}
      );
      for (let i = 0; i < 4; i++) void state.list[i].data[0].i;
      kept.push(state, state.list[1].data[0]);
      refs.push(new WeakRef(toRaw(state.list)));
      state.list = state.list.filter((entry: any) => entry.id !== 1 && entry.id !== 2);
    }
    for (let round = 0; round < 20; round++) setup();
    await collectGarbage();
    expect(alive(refs)).toBe(0);
    expect(kept.length).toBe(40);
  });
});
