import { expect, test } from "bun:test";
const imported = await import(process.env.RPS_LIB ?? "../src/index.ts");
const { reactive, updateState, toRaw, SnapshotLimitError } = imported.default ?? imported;

for (const async of [false, true]) {
  test(`equal contents keep distinct collection members, async=${async}`, async () => {
    const first = { id: 1 };
    const second = { id: 1 };
    const downstream: any = reactive({});
    const remote: any = reactive({}, (event: any) => updateState(downstream, event));
    const state = reactive({ members: new Set([first, second]), lookup: new Map([[first, 1], [second, 2]]) }, (event: any) => {
      updateState(remote, event);
    }, [], { async });
    await Promise.resolve();
    state.members.delete(first);
    state.lookup.set(second, 3);
    state.lookup.delete(first);
    await Promise.resolve();
    for (const replica of [remote, downstream]) {
      expect(toRaw(replica).members.size).toBe(1);
      expect([...toRaw(replica).lookup.values()]).toEqual([3]);
      expect([...toRaw(replica).members][0]).not.toBe(second);
    }
    state.members.delete(second);
    state.members.add(first);
    state.lookup.delete(second);
    state.lookup.set(first, 4);
    state.members.delete(first);
    state.lookup.delete(first);
    await Promise.resolve();
    for (const replica of [remote, downstream]) {
      expect(replica.members.size).toBe(0);
      expect(replica.lookup.size).toBe(0);
    }
  });

  test(`collection identities survive alias copies and reorders, async=${async}`, async () => {
    const member = { n: 1 };
    const shared = { set: new Set([member]), map: new Map([[member, 1]]) };
    let remote: any;
    const state = reactive({ rows: [shared, shared], lists: [] }, (event: any) => {
      if (!event.path.length) remote = event.newValue;
      else updateState(remote, event);
    }, [], { async });
    await Promise.resolve();
    state.rows.push({ set: new Set(), map: new Map() });
    state.rows.reverse();
    await Promise.resolve();
    state.rows[1].set.delete(member);
    state.rows[1].map.delete(member);
    await Promise.resolve();
    expect(remote.rows.map((row: any) => [row.set.size, row.map.size])).toEqual([[0, 0], [0, 0], [0, 0]]);
    const added = { n: 2 };
    state.rows[1].set.add(added);
    await Promise.resolve();
    expect(remote.rows[1].set.size).toBe(1);
    expect(remote.rows[2].set.size).toBe(1);
    state.rows[1].set.delete(added);
    await Promise.resolve();
    expect(remote.rows[1].set.size).toBe(0);
    expect(remote.rows[2].set.size).toBe(0);
  });

  for (const kind of ["array", "map", "set", "date"]) {
    test(`enumerable string and symbol properties survive ${kind} copies, async=${async}`, async () => {
      const symbol = Symbol("extra");
      const shared = { n: 1 };
      const value: any = kind === "array" ? [1] : kind === "map" ? new Map([["k", 1]]) : kind === "set" ? new Set([1]) : new Date(1234);
      value.extra = shared;
      value[symbol] = shared;
      Object.defineProperty(value, "__proto__", { value: shared, enumerable: true });
      let remote: any;
      const state = reactive({ values: [value], inserts: [] }, (event: any) => {
        if (!event.path.length) remote = event.newValue;
        else updateState(remote, event);
      }, [], { async });
      await Promise.resolve();
      state.inserts.push(value);
      state.values.unshift(kind === "array" ? [] : {});
      state.values.reverse();
      await Promise.resolve();
      for (const copy of [remote.values[0], remote.inserts[0]]) {
        expect(copy.extra).toEqual(shared);
        expect(copy[symbol]).toEqual(shared);
        expect(Object.hasOwn(copy, "__proto__")).toBe(true);
        expect(copy.__proto__).toEqual(shared);
        expect(copy.extra).not.toBe(shared);
        expect(copy[symbol]).not.toBe(copy.extra);
      }
    });
  }

  test(`reorder alias copies keep inner array names and symbols, async=${async}`, async () => {
    const symbol = Symbol("label");
    const item: any = [1];
    item.name = "a";
    item[symbol] = { n: 1 };
    const rows = [item, [2]];
    let remote: any;
    const state = reactive({ a: rows, b: rows }, (event: any) => {
      if (!event.path.length) remote = event.newValue;
      else updateState(remote, event);
    }, [], { async });
    await Promise.resolve();
    state.a.reverse();
    await Promise.resolve();
    for (const key of ["a", "b"]) {
      expect(remote[key][1].name).toBe("a");
      expect(remote[key][1][symbol]).toEqual({ n: 1 });
    }
    expect(remote.a[1][symbol]).not.toBe(remote.b[1][symbol]);
  });
}

for (const kind of ["array-symbol", "map-string", "set-symbol", "date-string"]) {
  test(`the copy limit counts ${kind} properties`, () => {
    let graph: object = {};
    for (let depth = 0; depth < 16; depth++) {
      const next: any = kind === "array-symbol" ? [] : kind === "map-string" ? new Map() : kind === "set-symbol" ? new Set() : new Date(0);
      const [a, b] = kind.endsWith("symbol") ? [Symbol("a"), Symbol("b")] : ["a", "b"];
      next[a] = graph;
      next[b] = graph;
      graph = next;
    }
    expect(() => reactive({ graph }, () => {})).toThrow(SnapshotLimitError);
  });
}
