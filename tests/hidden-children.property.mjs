// Random hides, shows, defines, deletes, aliases and writes inside the
// objects keys hold (3.0.18: a place under a hidden key leads to no root).
// After every step, a replica fed by the events holds what the source shows
// (JSON, keys sorted), and `updateState` logged no warning: no event names a
// path through a hidden key. Run by Bun (tests/hidden-children.bun.test.ts)
// and by Node: node tests/hidden-children.property.mjs <bundle> <runs> [seed]
import fc from "fast-check";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const keys = ["a", "b", "c", "d"];
const childKeys = ["n", "m"];

/** A value to store: a primitive, a fresh object or list, or an object of the state (an alias). */
const valueArbitrary = fc.oneof(
  fc.constantFrom(0, 1, 2),
  fc.constantFrom({ fresh: "object" }, { fresh: "list" }, { alias: "other" }),
  fc.constantFrom(...keys).map((key) => ({ alias: key }))
);

const freshArbitrary = fc.oneof(fc.constantFrom(0, 1, 2), fc.constantFrom({ fresh: "object" }, { fresh: "list" }));

const stepArbitrary = fc.oneof(
  fc.record({ op: fc.constantFrom("hide", "show", "delete"), key: fc.constantFrom(...keys) }),
  fc.record({ op: fc.constantFrom("set", "hidden"), key: fc.constantFrom(...keys), value: valueArbitrary }),
  // no alias inside a child: it could make a cycle, which JSON cannot compare
  fc.record({ op: fc.constantFrom("inner", "innerHidden"), key: fc.constantFrom(...keys), child: fc.constantFrom(...childKeys), value: freshArbitrary }),
  fc.record({ op: fc.constantFrom("innerHide", "innerShow"), key: fc.constantFrom(...keys), child: fc.constantFrom(...childKeys) }),
  fc.record({ op: fc.constant("deep"), key: fc.constantFrom(...keys), value: fc.integer({ min: 0, max: 3 }) }),
  fc.record({ op: fc.constant("other"), value: fc.integer({ min: 0, max: 3 }) }),
  fc.record({ op: fc.constantFrom("push", "item"), key: fc.constantFrom(...keys), value: fc.integer({ min: 0, max: 3 }) })
);

export const stepsArbitrary = fc.array(stepArbitrary, { minLength: 1, maxLength: 16 });

function sortedJson(value) {
  return JSON.stringify(value, (key, item) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]]))
      : item
  );
}

const isObject = (value) => value !== null && typeof value === "object";
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Runs `steps` on `lib`. Gives undefined when every step kept the replica
 * equal and logged no warning, else the first step that did not, with
 * what differed.
 */
export function runHiddenChildren(lib, steps) {
  const { reactive, updateState, toRaw } = lib;
  const source = { obj: { a: { n: 0 }, b: { n: 0, m: { x: 0 } }, c: 1 }, other: { n: 0 } };
  const remote = structuredClone(source);
  const warnings = [];
  const events = [];
  const state = reactive(source, (event) => {
    const wire = structuredClone(event);
    events.push(`${wire.action} ${wire.path.join(".")}`);
    const warn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      updateState(remote, wire);
    } finally {
      console.warn = warn;
    }
  });
  events.length = 0;
  const value = (spec) => {
    if (!isObject(spec)) return spec;
    if (spec.fresh === "object") return { n: 0, m: { x: 0 } };
    if (spec.fresh === "list") return [{ n: 0 }];
    if (spec.alias === "other") return state.other;
    const aliased = state.obj[spec.alias];
    // a primitive in place of an alias: no cycles, no missing object
    return isObject(aliased) ? aliased : 0;
  };
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const obj = state.obj;
    const child = has(toRaw(obj), step.key ?? "") ? obj[step.key] : undefined;
    switch (step.op) {
      case "hide":
      case "show":
        if (has(toRaw(obj), step.key)) Object.defineProperty(obj, step.key, { enumerable: step.op === "show" });
        break;
      case "delete":
        delete obj[step.key];
        break;
      case "set":
        obj[step.key] = value(step.value);
        break;
      case "hidden":
        Object.defineProperty(obj, step.key, { value: value(step.value), enumerable: false, writable: true, configurable: true });
        break;
      case "inner":
        if (isObject(child) && !Array.isArray(child)) child[step.child] = value(step.value);
        break;
      case "innerHidden":
        if (isObject(child) && !Array.isArray(child))
          Object.defineProperty(child, step.child, { value: value(step.value), enumerable: false, writable: true, configurable: true });
        break;
      case "innerHide":
      case "innerShow":
        if (isObject(child) && !Array.isArray(child) && has(toRaw(child), step.child))
          Object.defineProperty(child, step.child, { enumerable: step.op === "innerShow" });
        break;
      case "deep":
        if (isObject(child) && isObject(child.m) && !Array.isArray(child.m)) child.m.x = step.value;
        break;
      case "other":
        state.other.n = step.value;
        break;
      case "push":
        if (Array.isArray(child)) child.push({ n: step.value });
        break;
      case "item":
        if (Array.isArray(child) && isObject(child[0])) child[0].n = step.value;
        break;
    }
    const got = sortedJson(remote);
    const want = sortedJson(toRaw(state));
    if (got !== want || warnings.length > 0) return { step: index, op: step, replica: got, source: want, warnings, events };
  }
  return undefined;
}

/** The property over `runs` cases; throws with the shrunk counterexample. */
export function checkHiddenChildren(lib, runs, seed) {
  fc.assert(
    fc.property(stepsArbitrary, (steps) => {
      const failure = runHiddenChildren(lib, steps);
      if (failure !== undefined) throw new Error(JSON.stringify(failure));
    }),
    { numRuns: runs, seed }
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lib = await import(pathToFileURL(resolve(process.argv[2])).href);
  const runs = Number(process.argv[3] ?? 1000);
  const seed = process.argv[4] === undefined ? undefined : Number(process.argv[4]);
  checkHiddenChildren(lib, runs, seed);
  console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? "node" : "bun", runs, passed: true }));
}
