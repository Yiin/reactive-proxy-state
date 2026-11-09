// This model uses the write sequence and declared reads. It never reads library
// events, dependency tables, onTrack, or onTrigger to predict effect runs.
import fc from "fast-check";
import { stateText } from "./replica-property.model.mjs";

const small = fc.integer({ min: 0, max: 5 });
const names = ["a", "b", "sum", "list.0", "list.length", "list.sum", "map.k0", "map.k1", "map.size", "map.values", "set.has1", "set.size"];
export const oracleArbitrary = fc.record({
  reads: fc.array(fc.uniqueArray(fc.constantFrom(...names), { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
  writes: fc.array(fc.record({ op: fc.constantFrom("a", "b", "list.push", "list.pop", "list.0", "map.k0", "map.k1", "map.delete", "map.clear", "set.add", "set.delete", "set.clear"), value: small }), { minLength: 1, maxLength: 25 }),
  throws: fc.boolean(),
});

function read(state, name, sum) {
  switch (name) {
    case "a": return state.a;
    case "b": return state.b;
    case "sum": return sum.value;
    case "list.0": return state.list[0] ?? 0;
    case "list.length": return state.list.length;
    case "list.sum": return state.list.reduce((a, b) => a + b, 0);
    case "map.k0": return state.map.get("k0") ?? 0;
    case "map.k1": return state.map.get("k1") ?? 0;
    case "map.size": return state.map.size;
    case "map.values": return [...state.map.values()].reduce((a, b) => a + b, 0);
    case "set.has1": return Number(state.set.has(1));
    case "set.size": return state.set.size;
  }
}

function write(state, { op, value }) {
  switch (op) {
    case "a": state.a = value; break;
    case "b": state.b = value; break;
    case "list.push": state.list.push(value); break;
    case "list.pop": state.list.pop(); break;
    case "list.0": state.list[0] = value; break;
    case "map.k0": state.map.set("k0", value); break;
    case "map.k1": state.map.set("k1", value); break;
    case "map.delete": state.map.delete(value % 2 ? "k0" : "k1"); break;
    case "map.clear": state.map.clear(); break;
    case "set.add": state.set.add(value); break;
    case "set.delete": state.set.delete(value); break;
    case "set.clear": state.set.clear(); break;
  }
}

// Derive invalidations from plain before/after state and the command's meaning.
function affected(before, after, command) {
  const changed = new Set();
  for (const key of ["a", "b"]) if (before[key] !== after[key]) { changed.add(key); changed.add("sum"); }
  if (before.list.length !== after.list.length) changed.add("list.length");
  if (before.list[0] !== after.list[0]) changed.add("list.0");
  if (JSON.stringify(before.list) !== JSON.stringify(after.list)) changed.add("list.sum");
  for (const key of ["k0", "k1"]) if (before.map.get(key) !== after.map.get(key) || before.map.has(key) !== after.map.has(key)) { changed.add("map." + key); changed.add("map.values"); }
  if (before.map.size !== after.map.size) changed.add("map.size");
  if (before.set.has(1) !== after.set.has(1)) changed.add("set.has1");
  if (before.set.size !== after.set.size) changed.add("set.size");
  return changed;
}

export function runOracle(lib, spec) {
  const initial = { a: 0, b: 0, list: [0, 1], map: new Map([["k0", 0]]), set: new Set([1]), version: 0, outputs: spec.reads.map(() => 0) };
  const model = structuredClone(initial);
  let remote;
  let armed = false;
  const state = lib.reactive(initial, event => {
    if (!event.path.length) { remote = event.newValue; return; }
    try {
      // This read must never become an effect dependency.
      if (armed && event.path[0] !== "version") state.version++;
    } finally { lib.updateState(remote, event); }
  });
  const sum = lib.computed(() => state.a + state.b);
  const actual = spec.reads.map(() => 0);
  const expected = spec.reads.map(() => 1);
  const stops = spec.reads.map((reads, index) => lib.watchEffect(() => {
    actual[index]++;
    const value = reads.reduce((total, name) => total + read(state, name, sum), 0);
    state.outputs[index] = value;
    if (armed && spec.throws && value % 3 === 2) throw new Error("oracle effect");
  }));
  armed = true;
  let failure;
  for (const [step, command] of spec.writes.entries()) {
    const before = structuredClone(model);
    write(model, command);
    const changed = affected(before, model, command);
    spec.reads.forEach((reads, index) => { if (reads.some(name => changed.has(name))) expected[index]++; });
    try { write(state, command); } catch (error) { if (error.message !== "oracle effect") throw error; }
    if (actual.some((count, index) => count !== expected[index])) { failure = { step, command, actual: [...actual], expected: [...expected] }; break; }
    if (stateText(lib, state) !== stateText(lib, remote)) { failure = { step, replica: true }; break; }
  }
  stops.forEach(stop => stop());
  sum.stop();
  return { failure, runs: actual.reduce((a, b) => a + b, 0), writes: spec.writes.length };
}
