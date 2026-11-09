import fc from "fast-check";
export const oldValueArbitrary = fc.record({
  kind: fc.constantFrom("object", "map", "set", "pop", "splice", "reverse"),
  before: fc.integer({ min: -100, max: 100 }),
  after: fc.integer({ min: 101, max: 200 }),
  count: fc.integer({ min: 2, max: 5 }),
});
export function runOldValue(lib, spec) {
  const shared = { n: 0 };
  const member = { n: spec.before, detail: { label: String(spec.before) } };
  const list = Array.from({ length: spec.count }, () => structuredClone(member));
  list[list.length - 1].n += 1;
  if (spec.kind === "pop") list[list.length - 1].n = spec.before;
  let armed = false;
  let observed;
  const state = lib.reactive({ a: shared, b: shared, child: structuredClone(member), map: new Map([["key", structuredClone(member)]]), set: new Set([structuredClone(member)]), list }, event => {
    if (!armed) return;
    if (event.path.join(".") === "a.n") {
      const held = spec.kind === "object" ? state.child : spec.kind === "map" ? state.map.get("key") : spec.kind === "set" ? [...state.set][0] : state.list[spec.kind === "pop" ? state.list.length - 1 : 0];
      switch (spec.kind) {
        case "object": state.child = { n: spec.after, detail: { label: "new" } }; break;
        case "map": state.map.delete("key"); break;
        case "set": state.set.delete(lib.toRaw(held)); break;
        case "pop": state.list.pop(); break;
        case "splice": state.list.splice(0, 1); break;
        case "reverse": state.list.reverse(); break;
      }
      held.n = spec.after;
      held.detail.label = "changed";
    }
    if (["child", "map", "set", "list"].includes(event.path[0]) && observed === undefined) {
      const old = spec.kind === "splice" ? event.oldValues[0] : spec.kind === "reverse" ? event.oldValue[0] : event.oldValue;
      observed = JSON.stringify(old);
    }
  });
  armed = true;
  state.a.n = 1;
  return { observed, expected: JSON.stringify(member) };
}
