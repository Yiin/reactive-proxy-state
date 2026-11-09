import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { reactive, computed, watchEffect } = await import(pathToFileURL(resolve(process.argv[2])).href);
let armed = false;
const totals = [];
const state = reactive({ list: [1], tick: 0, total: 0 }, event => {
  if (!armed) return;
  if (event.path[0] === "list") state.tick++;
  if (event.path[0] === "total") totals.push(event.newValue);
});
const double = computed(() => state.list[0] * 2);
const stop = watchEffect(() => { state.tick; state.total = state.list[0] + double.value; });
armed = true;
state.list[0] = 2;
assert.deepEqual(totals, [6]);
stop(); double.stop();
for (const kind of ["array", "map", "set"]) {
  for (const method of ["keys", "values", "entries", Symbol.iterator]) {
    const value = reactive(kind === "array" ? [1, 2, 3] : kind === "map" ? new Map([[1, 1], [2, 2], [3, 3]]) : new Set([1, 2, 3]));
    const iterator = value[method]();
    const steps = [];
    const stop = watchEffect(() => steps.push(iterator.next()));
    for (const number of [2, 3]) {
      if (kind === "array") value[number - 1] = number * 10;
      else if (kind === "map") value.set(number, number * 10);
      else value.add(number * 10);
    }
    assert.equal(steps.length, 3, `${kind} ${String(method)}`);
    assert.equal(steps[2].done, false);
    stop();
  }
}
for (const method of ["getOrInsert", "getOrInsertComputed"]) {
  const events = [];
  const map = reactive(new Map(), event => events.push(event));
  events.length = 0;
  const value = method === "getOrInsert" ? map[method]("key", { n: 1 }) : map[method]("key", () => ({ n: 1 }));
  value.n = 2;
  assert.deepEqual(events.map(event => event.action), ["map-set", "set"]);
  assert.equal(map.get("key").n, 2);
}
console.log("listener order, 12 saved iterators, and both insertion methods pass");
