import { expect, test } from 'bun:test';
const imported = await import(process.env.RPS_LIB ?? "../src/index.ts");
const { reactive, updateState, toRaw } = imported.default ?? imported;
for (const async of [false, true]) {
  test(`Set add/delete replays object membership, async=${async}`, async () => {
    const replica = reactive({});
    const state = reactive({ members: new Set() }, (event: any) => updateState(replica, event), [], { async });
    await Promise.resolve();
    const member = { id: 1 };
    state.members.add(member);
    await Promise.resolve();
    expect(replica.members.size).toBe(1);
    state.members.delete(member);
    await Promise.resolve();
    expect(replica.members.size).toBe(toRaw(state).members.size);
  });
  test(`Map delete replays an initial object key, async=${async}`, async () => {
    const key = { id: 1 };
    const replica = reactive({});
    const state = reactive({ lookup: new Map([[key, 1]]) }, (event: any) => updateState(replica, event), [], { async });
    await Promise.resolve();
    state.lookup.delete(key);
    await Promise.resolve();
    expect(replica.lookup.size).toBe(toRaw(state).lookup.size);
  });
  test(`initial array copy keeps enumerable symbols, async=${async}`, async () => {
    const key = Symbol('metadata');
    const list: any = [1];
    list[key] = { n: 2 };
    let initial: any;
    reactive({ list }, (event: any) => { initial = event.newValue; }, [], { async });
    await Promise.resolve();
    expect(Object.hasOwn(initial.list, key)).toBe(true);
    expect(initial.list[key]).toEqual({ n: 2 });
  });
  for (const kind of ['Map', 'Set']) {
    test(`initial ${kind} copy keeps enumerable properties, async=${async}`, async () => {
      const collection: any = kind === 'Map' ? new Map() : new Set();
      collection.extra = { n: 2 };
      let initial: any;
      reactive({ collection }, (event: any) => { initial = event.newValue; }, [], { async });
      await Promise.resolve();
      expect(Object.hasOwn(initial.collection, 'extra')).toBe(true);
      expect(initial.collection.extra).toEqual({ n: 2 });
    });
  }
}
for (const async of [false, true]) {
  test(`reorder preserves nested array properties, async=${async}`, async () => {
    const a = Object.assign([1], { name: 'a' });
    const b = Object.assign([2], { name: 'b' });
    let replica: any;
    const state = reactive({ rows: [a, b] }, (event: any) => {
      if (!event.path.length) replica = event.newValue;
      else updateState(replica, event);
    }, [], { async });
    await Promise.resolve();
    state.rows.reverse();
    await Promise.resolve();
    expect(replica.rows[0].name).toBe(toRaw(state).rows[0].name);
    expect(replica.rows[1].name).toBe(toRaw(state).rows[1].name);
  });
}

test("async nested writes reach the replica before uncaughtException", () => {
  const run = Bun.spawnSync([process.execPath, `${import.meta.dir}/fixtures/async-nested-error.ts`], { env: process.env });
  expect(run.stderr.toString()).toBe("");
  expect(run.exitCode).toBe(0);
});
