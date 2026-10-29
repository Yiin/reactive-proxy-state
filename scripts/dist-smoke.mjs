// Checks the built bundles that `npm publish` ships: the ES module imports,
// the CommonJS bundle requires, both export the same names, and each keeps
// native array behavior and a replica in sync. Run after `bun run build`:
//   node scripts/dist-smoke.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const esm = await import(new URL("../dist/index.js", import.meta.url).href);
const cjs = createRequire(import.meta.url)(dist + "index.cjs");

assert.deepEqual(Object.keys(cjs).sort(), Object.keys(esm).sort(), "ESM and CJS export the same names");
for (const name of ["reactive", "updateState", "toRaw", "deepToRaw", "SnapshotLimitError", "UnsupportedStateError"]) {
  assert.ok(name in esm, `the package exports ${name}`);
}
for (const name of ["wrapChild", "wrapUnplaced"]) assert.ok(!(name in esm), `${name} stays internal`);

/** fill, copyWithin, sort and reverse through a proxy match the same call on a plain array. */
function nativeArrays(lib) {
  const bounds = [undefined, null, NaN, -Infinity, Infinity, -7, -1.8, -1, 0, 0.5, 1, 3, 9];
  const shape = (array) => ({ length: array.length, keys: Object.keys(array), values: Array.from(array) });
  let count = 0;
  for (const sparse of [false, true]) {
    for (const method of ["fill", "copyWithin"]) {
      for (const start of bounds) {
        for (const end of bounds) {
          const plain = sparse ? [3, , 1, undefined] : [3, 2, 1, 0];
          const list = plain.slice();
          const root = lib.reactive({ list }, () => {});
          const args = method === "fill" ? [9, start, end] : [0, start, end];
          let nativeError;
          let proxyError;
          try {
            plain[method](...args);
          } catch (error) {
            nativeError = error.name;
          }
          try {
            root.list[method](...args);
          } catch (error) {
            proxyError = error.name;
          }
          assert.deepEqual({ error: proxyError, state: shape(list) }, { error: nativeError, state: shape(plain) }, `${method}(${args.slice(1)}) sparse=${sparse}`);
          count++;
        }
      }
    }
  }
  for (const method of ["sort", "reverse"]) {
    for (const array of [[3, , 1, undefined], [undefined, , ], [], [1]]) {
      const plain = array.slice();
      const list = array.slice();
      plain[method]();
      lib.reactive({ list }, () => {}).list[method]();
      assert.deepEqual(shape(list), shape(plain), `${method} ${JSON.stringify(array)}`);
      count++;
    }
  }
  return count;
}

/** A replica built from the initial replace and fed every event equals the state. */
function replica(lib) {
  let copy;
  const state = lib.reactive({ rows: [{ id: 1, tags: new Set(["a"]) }], map: new Map([[{ k: 1 }, 1]]) }, (event) => {
    if (event.action === "replace" && event.path.length === 0) copy = event.newValue;
    else lib.updateState(copy, event);
  });
  const shared = { n: 0 };
  state.rows.push({ id: 2, ref: shared }, { id: 3, ref: shared });
  state.rows[1].ref.n = 5;
  state.rows.splice(0, 1);
  state.rows[0].tags = new Set(["b"]);
  const key = [...lib.toRaw(state.map).keys()][0];
  state.map.set(key, 2);
  state.map.delete(key);
  const text = (value) => JSON.stringify(value, (_, item) => (item instanceof Map || item instanceof Set ? [...item] : item));
  assert.equal(text(copy), text(lib.toRaw(state)), "the replica equals the state");
}

for (const [name, lib] of [["ESM", esm], ["CJS", cjs]]) {
  const count = nativeArrays(lib);
  replica(lib);
  console.log(`${name}: ${count} native array cases and a replica round trip pass`);
}
