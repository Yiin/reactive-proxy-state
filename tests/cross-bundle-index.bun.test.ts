import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import type * as source from "../src/index";
import * as esm from "../dist/index.js";

/**
 * The ES module and CommonJS bundles can both load in one realm. They share
 * the member tokens, a collection's index and the flag that tells a Set or
 * Map proxy that its collection has an index. When `updateState` from one
 * bundle builds the index of a collection whose proxy the other bundle made,
 * the proxy's writes must still keep that index current. Otherwise a delete
 * and an add of the same size through the proxy leave the index stale, and
 * the next event from the other side misses the new member.
 */

type Library = typeof source;
const cjs = createRequire(import.meta.url)("../dist/index.cjs") as Library;
const bundles: [string, Library][] = [
  ["esm", esm as unknown as Library],
  ["cjs", cjs],
];

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * `source` is a root made by `roots`. `mirror` is a reactive root, also made
 * by `roots`, on the source's replica. Each side applies the other's events
 * with `updates.updateState`, and the source mutes the echo of what it
 * applied from the mirror.
 */
async function bidirectional(roots: Library, updates: Library, options?: { async: true }) {
  let replica: any;
  let applyingFromMirror = false;
  const source: any = roots.reactive(
    { set: new Set<object>(), map: new Map<object, number>() },
    (event) => {
      if (event.action === "replace" && event.path.length === 0) {
        replica = event.newValue;
        return;
      }
      if (applyingFromMirror) return;
      updates.updateState(mirror, event);
    },
    [],
    options
  );
  await tick();
  const mirror: any = roots.reactive(
    replica,
    (event) => {
      if (event.action === "replace" && event.path.length === 0) return;
      applyingFromMirror = true;
      try {
        updates.updateState(source, event);
      } finally {
        applyingFromMirror = false;
      }
    },
    [],
    options
  );
  return { source, mirror };
}

function members(lib: Library, collection: Iterable<any>): number[] {
  return [...collection].map((member) => lib.toRaw(member).id).sort();
}

describe("a proxy from one bundle keeps the index the other bundle built", () => {
  for (const [rootsName, roots] of bundles) {
    for (const [updatesName, updates] of bundles) {
      if (rootsName === updatesName) continue;
      for (const options of [undefined, { async: true } as const]) {
        const mode = options ? "async" : "sync";

        test(`Set, ${mode}: roots from ${rootsName}, updateState from ${updatesName}`, async () => {
          const { source, mirror } = await bidirectional(roots, updates, options);
          source.set.add({ id: 1 });
          source.set.add({ id: 2 });
          await tick();
          const [first] = [...roots.toRaw(mirror).set];
          mirror.set.delete(first);
          mirror.set.add({ id: 9 });
          await tick();
          expect(members(roots, roots.toRaw(source).set)).toEqual([2, 9]);
          expect(members(roots, roots.toRaw(mirror).set)).toEqual([2, 9]);

          const added = [...roots.toRaw(source).set].find((member: any) => member.id === 9);
          source.set.delete(added);
          await tick();
          expect(members(roots, roots.toRaw(source).set)).toEqual([2]);
          expect(members(roots, roots.toRaw(mirror).set)).toEqual([2]);
        });

        test(`Map, ${mode}: roots from ${rootsName}, updateState from ${updatesName}`, async () => {
          const { source, mirror } = await bidirectional(roots, updates, options);
          source.map.set({ id: 1 }, 1);
          source.map.set({ id: 2 }, 2);
          await tick();
          const [first] = [...roots.toRaw(mirror).map.keys()];
          mirror.map.delete(first);
          mirror.map.set({ id: 9 }, 9);
          await tick();
          expect(members(roots, roots.toRaw(source).map.keys())).toEqual([2, 9]);
          expect(members(roots, roots.toRaw(mirror).map.keys())).toEqual([2, 9]);

          const added = [...roots.toRaw(source).map.keys()].find((key: any) => key.id === 9);
          source.map.delete(added);
          await tick();
          expect(members(roots, roots.toRaw(source).map.keys())).toEqual([2]);
          expect(members(roots, roots.toRaw(mirror).map.keys())).toEqual([2]);
        });
      }
    }
  }
});
