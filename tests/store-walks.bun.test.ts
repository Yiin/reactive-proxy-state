import { describe, expect, test } from "bun:test";
import { reactive, toRaw, updateState } from "../src/index";
import { treeText } from "./replica";

/**
 * A store finds the places of what it stores from the value as it is at
 * that store. Nothing learned at an earlier store of the same objects may
 * stand in for that walk: since then, an object inside the value can have
 * been stored elsewhere, read through a proxy, or put next to another part
 * of the value. A copy shortcut must also see the object it writes to.
 */

/** A root and a replica fed by its events, each event crossing a wire (structuredClone). */
async function setup(raw: any, async: boolean) {
  let remote: any;
  const events: any[] = [];
  const state: any = reactive(
    raw,
    (event: any) => {
      const copy = structuredClone(event);
      if (event.action === "replace" && event.path.length === 0) remote = copy.newValue;
      else {
        events.push(copy);
        updateState(remote, copy);
      }
    },
    [],
    { async }
  );
  await Promise.resolve();
  return {
    state,
    events,
    remote: () => remote,
    paths: () => events.map((event) => event.path.join(".")).sort(),
    inSync: () => treeText(toRaw(state)) === treeText(remote),
  };
}

const settle = () => Promise.resolve();

for (const async of [false, true]) {
  describe(`a value stored before is walked again when it is stored again, async=${async}`, () => {
    test("removed, then stored next to its own child: both places get each write", async () => {
      const sync = await setup({ list: [], box: null }, async);
      const child = { n: 0 };
      const fresh = { child };
      sync.state.list.push(fresh);
      sync.state.list.pop();
      sync.state.box = { a: fresh, b: child };
      await settle();
      sync.events.length = 0;
      sync.state.box.b.n = 1;
      await settle();
      expect(sync.remote()).toEqual(toRaw(sync.state));
      expect(sync.paths()).toEqual(["box.a.child.n", "box.b.n"]);
    });

    test("removed, its child stored and read elsewhere, then stored again", async () => {
      const sync = await setup({ list: [], other: null, box: null }, async);
      const child = { n: 0 };
      const fresh = { child };
      sync.state.list.push(fresh);
      sync.state.list.pop();
      sync.state.other = child;
      const retained = sync.state.other;
      sync.state.box = { fresh };
      await settle();
      sync.events.length = 0;
      retained.n = 1;
      await settle();
      expect(sync.remote()).toEqual(toRaw(sync.state));
      expect(sync.paths()).toEqual(["box.fresh.child.n", "other.n"]);
    });

    test("a proxy of the child made before the value is stored again, by each insertion", async () => {
      for (const insert of ["push", "unshift", "splice", "index", "assign", "map"] as const) {
        const sync = await setup({ list: [{ id: 0 }], other: null, box: null, map: new Map() }, async);
        const child = { n: 0 };
        const fresh = { deep: { child } };
        sync.state.list.push(fresh);
        sync.state.list.splice(1, 1);
        sync.state.other = child;
        const retained = sync.state.other;
        if (insert === "push") sync.state.list.push(fresh);
        if (insert === "unshift") sync.state.list.unshift(fresh);
        if (insert === "splice") sync.state.list.splice(1, 0, fresh);
        if (insert === "index") sync.state.list[0] = fresh;
        if (insert === "assign") sync.state.box = fresh;
        if (insert === "map") sync.state.map.set("k", fresh);
        await settle();
        sync.events.length = 0;
        retained.n = 1;
        await settle();
        expect(sync.inSync()).toBe(true);
        expect(sync.events.length).toBe(2);
      }
    });

    test("removed with an unread ancestor, then stored again next to its child", async () => {
      const sync = await setup({ outer: null, box: null }, async);
      const child = { n: 0 };
      const fresh = { child };
      sync.state.outer = { holder: { list: [] } };
      sync.state.outer.holder.list.push(fresh);
      sync.state.outer = null;
      sync.state.box = [fresh, child];
      await settle();
      sync.events.length = 0;
      sync.state.box[1].n = 1;
      await settle();
      expect(sync.inSync()).toBe(true);
      expect(sync.paths()).toEqual(["box.0.child.n", "box.1.n"]);
    });

    test("stored again next to its child after its own proxy was read", async () => {
      const sync = await setup({ list: [], box: null }, async);
      const child = { n: 0 };
      const fresh = { child };
      sync.state.list.push(fresh);
      const throughProxy = sync.state.list[0].child;
      sync.state.list.pop();
      sync.state.box = { a: fresh, b: child };
      await settle();
      sync.events.length = 0;
      throughProxy.n = 1;
      await settle();
      expect(sync.inSync()).toBe(true);
      expect(sync.paths()).toEqual(["box.a.child.n", "box.b.n"]);
    });

    test("stored twice in one push after it left the tree", async () => {
      const sync = await setup({ list: [] }, async);
      const child = { n: 0 };
      const fresh = { child };
      sync.state.list.push(fresh);
      sync.state.list.shift();
      sync.state.list.push(fresh, { again: child });
      await settle();
      sync.events.length = 0;
      sync.state.list[1].again.n = 1;
      await settle();
      expect(sync.inSync()).toBe(true);
      expect(sync.paths()).toEqual(["list.0.child.n", "list.1.again.n"]);
    });

    test("kept by a filter beside the proxy of its child stored elsewhere", async () => {
      const sync = await setup({ list: [{ id: 0 }], other: null }, async);
      const child = { n: 0 };
      const item = { child };
      sync.state.list.push(item);
      void sync.state.list[0].id;
      sync.state.list.pop();
      sync.state.other = child;
      const retained = sync.state.other;
      sync.state.list.push(item);
      sync.state.list = sync.state.list.filter(() => true);
      await settle();
      sync.events.length = 0;
      retained.n = 1;
      await settle();
      expect(sync.inSync()).toBe(true);
      expect(sync.paths()).toEqual(["list.1.child.n", "other.n"]);
    });
  });

  test(`a new root holding a value another root stored before, next to its child, async=${async}`, async () => {
    const first = await setup({ list: [] }, async);
    const child = { n: 0 };
    const fresh = { child };
    first.state.list.push(fresh);
    first.state.list.pop();
    const second = await setup({ a: fresh, b: child }, async);
    second.state.b.n = 1;
    await settle();
    expect(second.inSync()).toBe(true);
    expect(second.paths()).toEqual(["a.child.n", "b.n"]);
  });

  describe(`small arrays that hold the object they are written to, async=${async}`, () => {
    test("the array is copied with its back-reference", async () => {
      const raw: any = { x: null, n: 0 };
      const sync = await setup(raw, async);
      sync.state.x = [raw];
      await settle();
      expect(sync.events[0].newValue[0].x).toBe(sync.events[0].newValue);
      expect(sync.remote().x[0].x).toBe(sync.remote().x);
    });

    test("a back-reference after other items, and a nested leaf that holds itself", async () => {
      const raw: any = { x: null, n: 0, leaf: { w: 0 } };
      const sync = await setup(raw, async);
      sync.state.x = [{ m: 1 }, raw, 2];
      const leaf = sync.state.leaf;
      leaf.self = [{ w: 2 }, toRaw(leaf)];
      await settle();
      const [x, self] = sync.events;
      expect(x.newValue[1].x).toBe(x.newValue);
      expect(x.newValue[1].n).toBe(0);
      expect(self.newValue[1].self).toBe(self.newValue);
      expect(self.newValue[1].w).toBe(0);
      expect(sync.remote().x[1].x).toBe(sync.remote().x);
      expect(sync.remote().leaf.self[1].self).toBe(sync.remote().leaf.self);
    });
  });
}
