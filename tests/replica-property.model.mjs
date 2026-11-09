// Random cases for tests/replica-property.bun.test.ts and
// tests/replica-property.run.mjs: a state, effects that read it, write it
// and throw, a listener that writes state before or after it forwards each
// event to a replica, and the writes a caller makes. `runCase` runs one case
// on a build of the library and returns what the replica received.
//
// The listener forwards every event. Before it forwards, it writes only its
// own keys (`version`, `log`, `marks`), as a sync layer stamps an event:
// a listener that writes the key it has not forwarded yet sends the replica
// the two writes in the wrong order, whatever the library does. After it
// forwards, it may write any key.
import fc from "fast-check";
import { eventText } from "./event-stream.ops.mjs";

/** What an effect can read: a number from the state, and the top-level keys it reads. */
const sources = {
  a: { heads: ["a"], read: (s) => s.a },
  b: { heads: ["b"], read: (s) => s.b },
  c: { heads: ["c"], read: (s) => s.c },
  "o.p": { heads: ["o"], read: (s) => s.o.p ?? -1 },
  "o.q": { heads: ["o"], read: (s) => s.o.q ?? -1 },
  "o.json": { heads: ["o"], read: (s) => JSON.stringify(s.o).length },
  "list.length": { heads: ["list"], read: (s) => s.list.length },
  "list.0": { heads: ["list"], read: (s) => s.list[0] ?? -1 },
  "list.sum": { heads: ["list"], read: (s) => s.list.reduce((total, value) => total + (value ?? 0), 0) },
  "list.join": { heads: ["list"], read: (s) => s.list.join().length },
  "map.size": { heads: ["map"], read: (s) => s.map.size },
  "map.k0": { heads: ["map"], read: (s) => s.map.get("k0") ?? -1 },
  "map.values": { heads: ["map"], read: (s) => [...s.map.values()].reduce((total, value) => total + value, 0) },
  "set.size": { heads: ["set"], read: (s) => s.set.size },
  "set.has1": { heads: ["set"], read: (s) => (s.set.has(1) ? 1 : 0) },
  "set.sum": { heads: ["set"], read: (s) => [...s.set].reduce((total, value) => total + value, 0) },
  computed: { heads: ["a", "list"], read: (s, computed) => computed.value },
  d0: { heads: ["d0"], read: (s) => s.d0 },
  d1: { heads: ["d1"], read: (s) => s.d1 },
  version: { heads: ["version"], read: (s) => s.version },
  "log.length": { heads: ["log"], read: (s) => s.log.length },
  "marks.size": { heads: ["marks"], read: (s) => s.marks.size },
};
const sourceNames = Object.keys(sources);
const derived = ["d0", "d1", "d2"];
const clampTargets = ["a", "b", "c", "o.p", "o.q"];
/** The listener's own keys. No rule fires on their events. */
const listenerKeys = ["version", "log", "marks"];
/** Top-level keys a rule fires on; "*" is any of them. */
const ruleHeads = ["objectMap", "objectSet", "objects", "a", "b", "c", "o", "list", "map", "set", "d", "*"];

const small = fc.integer({ min: 0, max: 9 });

const effectArbitrary = fc.record({
  reads: fc.uniqueArray(fc.constantFrom(...sourceNames), { minLength: 1, maxLength: 3 }),
  kind: fc.constantFrom("mirror", "mirror", "clamp", "trim", "read"),
  clamp: fc.constantFrom(...clampTargets),
  trim: fc.constantFrom("list", "map", "set"),
  limit: fc.integer({ min: 1, max: 6 }),
  // 0: never throws
  throwMod: fc.constantFrom(0, 0, 2, 3, 5),
  throwAt: small,
  throwAfterWrite: fc.boolean(),
  // one effect in ten has an onTrigger hook that throws
  hookThrows: fc.integer({ min: 0, max: 9 }).map((value) => value === 0),
});

// "bump" is `version++`, the others write a number the listener counts,
// and read no key
const ruleArbitrary = fc.oneof(
  fc.record({ on: fc.constantFrom(...ruleHeads), when: fc.constant("before"), write: fc.constantFrom("version", "bump", "log", "marks") }),
  fc.record({ on: fc.constantFrom(...ruleHeads), when: fc.constant("after"), write: fc.constantFrom("version", "bump", "log", "marks", "a", "o.q", "list", "set") })
);

/** A write a caller makes. `srjbj9` marks the writes 3.0.3 dropped (no event); they are rare. */
const writeArbitrary = fc.oneof(
  { arbitrary: fc.record({ op: fc.constantFrom("objectMap.set", "objectMap.delete", "objectSet.add", "objectSet.delete", "objects.splice"), value: small }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("set"), key: fc.constantFrom("a", "b", "c", "d0"), value: small }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("o.set"), key: fc.constantFrom("p", "q", "r"), value: small }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("o.delete"), key: fc.constantFrom("p", "q", "r") }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("o.replace"), p: small, q: small }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("list.push"), values: fc.array(small, { minLength: 1, maxLength: 2 }) }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constantFrom("list.pop", "list.shift", "list.sort", "list.reverse") }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("list.unshift"), values: fc.array(small, { minLength: 1, maxLength: 2 }) }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("list.splice"), start: fc.integer({ min: 0, max: 4 }), count: fc.integer({ min: 0, max: 2 }), values: fc.array(small, { maxLength: 2 }) }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("list.index"), index: fc.integer({ min: 0, max: 5 }), value: small }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("list.length"), length: fc.integer({ min: 0, max: 6 }) }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("list.replace"), values: fc.array(small, { maxLength: 4 }) }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("map.set"), key: fc.constantFrom("k0", "k1", "k2", "k3"), value: small }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("map.delete"), key: fc.constantFrom("k0", "k1", "k2", "k3") }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constantFrom("map.clear", "set.clear") }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constantFrom("set.add", "set.delete"), value: fc.integer({ min: 0, max: 5 }) }), weight: 8 },
  { arbitrary: fc.record({ op: fc.constant("o.undefined"), srjbj9: fc.constant(true) }), weight: 1 },
  { arbitrary: fc.record({ op: fc.constantFrom("map.getOrInsert", "map.getOrInsertComputed"), key: fc.constantFrom("k0", "k4"), value: small, srjbj9: fc.constant(true) }), weight: 1 }
);

const initArbitrary = fc.record({
  // `o2` is `o` itself: a write into it sends one event per place
  alias: fc.boolean(),
  objects: fc.array(fc.record({ n: small }), { minLength: 1, maxLength: 3 }),
  a: small,
  b: small,
  c: small,
  p: small,
  q: small,
  list: fc.array(small, { maxLength: 4 }),
  map: fc.uniqueArray(fc.tuple(fc.constantFrom("k0", "k1", "k2", "k3"), small), { maxLength: 3, selector: ([key]) => key }),
  set: fc.uniqueArray(fc.integer({ min: 0, max: 5 }), { maxLength: 3 }),
});

/**
 * A case: the initial state, the effects, the listener's rules and the
 * caller's writes. A mirror effect writes `d<n>`, its place among the
 * mirrors, and reads no `d` at or after it, so effects end.
 */
export function caseArbitrary({ hooks = true } = {}) {
  return fc
    .record({
      init: initArbitrary,
      effects: fc.array(effectArbitrary, { maxLength: 5 }),
      rules: fc.array(ruleArbitrary, { maxLength: 4 }),
      writes: fc.array(writeArbitrary, { minLength: 1, maxLength: 6 }),
    })
    .map(({ init, effects, rules, writes }) => {
      let mirrors = 0;
      const shaped = [];
      for (const effect of effects) {
        const kind = effect.kind === "mirror" && mirrors >= derived.length ? "read" : effect.kind;
        const target = kind === "mirror" ? derived[mirrors++] : undefined;
        const limit = target === undefined ? derived.length : derived.indexOf(target);
        const reads = effect.reads.filter((name) => !derived.includes(name) || derived.indexOf(name) < limit);
        shaped.push({
          reads: reads.length > 0 ? reads : ["a"],
          kind,
          target: kind === "mirror" ? target : kind === "clamp" ? effect.clamp : kind === "trim" ? effect.trim : undefined,
          limit: effect.limit,
          throwMod: effect.throwMod,
          throwAt: effect.throwAt,
          throwAfterWrite: effect.throwAfterWrite,
          hookThrows: hooks && effect.hookThrows,
        });
      }
      return { init, effects: shaped, rules, writes };
    });
}

/** The top-level keys an effect reads, its own target included. */
function effectHeads(effect) {
  const heads = new Set(effect.reads.flatMap((name) => sources[name].heads));
  if (effect.kind === "clamp") heads.add(effect.target.split(".")[0]);
  if (effect.kind === "trim") heads.add(effect.target);
  return heads;
}

/**
 * How a case compares with 3.0.3. `srjbj9`: a write 3.0.3 dropped.
 * `hooks`: an onTrigger hook throws (3.0.4 runs hooks in the flush).
 * `listenerReads`: an effect reads a key the listener writes; such an
 * effect waits for the outermost write, where 3.0.3 ran it inside the
 * listener's write, before the listener forwarded the event it received.
 * An effect that writes runs the listener inside itself, so it also reads
 * what the listener reads: `version` for a "bump" rule. `queued`: a write
 * sends several events (a longer `length`) to a listener that writes; its
 * writes wait for those events, where 3.0.3 sent the queue from inside the
 * listener's write. An alias of `o` sends one event per place.
 */
export function classify(spec) {
  const written = new Set(spec.rules.map((rule) => (rule.write === "bump" ? "version" : rule.write.split(".")[0])));
  const bumps = spec.rules.some((rule) => rule.write === "bump");
  const reads = (effect) => {
    const heads = effectHeads(effect);
    if (bumps && effect.kind !== "read") heads.add("version");
    return heads;
  };
  return {
    srjbj9: spec.writes.some((write) => write.srjbj9 === true),
    hooks: spec.effects.some((effect) => effect.hookThrows),
    listenerReads: spec.effects.some((effect) => [...reads(effect)].some((head) => written.has(head))),
    queued: spec.rules.length > 0 && (spec.init.alias || spec.writes.some((write) => write.op === "list.length")),
  };
}

/** Cases outside the new bound and untracked listener reads, safe to run on 3.0.6. */
export function comparable(spec) {
  const written = new Set(spec.rules.map(rule => rule.write === "bump" ? "version" : rule.write.split(".")[0]));
  return spec.rules.every(rule => listenerKeys.includes(rule.write) || rule.write === "bump") &&
    spec.effects.every(effect => effect.kind === "read" ||
      (!spec.rules.some(rule => rule.write === "bump") &&
       [...effectHeads(effect)].every(head => !written.has(head))));
}

/**
 * Text of a value, with Maps and Sets: two equal states give the same
 * text. A hole reads as `undefined`: a longer `length` sends `undefined` for
 * each new index, as since 3.0.2, and a wire (JSON) carries no holes.
 */
export function stateText(lib, value) {
  if (value === null || typeof value !== "object") return Object.is(value, -0) ? "-0" : JSON.stringify(value) ?? String(value);
  value = lib.toRaw(value);
  if (value instanceof Map) return `Map{${[...value].map(([key, item]) => `${stateText(lib, key)}=>${stateText(lib, item)}`).join(",")}}`;
  if (value instanceof Set) return `Set{${[...value].map((item) => stateText(lib, item)).join(",")}}`;
  if (Array.isArray(value)) {
    const items = [];
    for (let i = 0; i < value.length; i++) items.push(stateText(lib, value[i]));
    return `[${items.join(",")}]`;
  }
  return `{${Object.keys(value).map((key) => `${JSON.stringify(key)}:${stateText(lib, value[key])}`).join(",")}}`;
}

function makeState(init) {
  const o = { p: init.p, q: init.q };
  return {
    objectMap: new Map((init.objects ?? []).map((value, index) => ["k" + index, { ...value }])),
    objectSet: new Set((init.objects ?? []).map(value => ({ ...value }))),
    objects: (init.objects ?? []).map(value => ({ ...value })),
    a: init.a,
    b: init.b,
    c: init.c,
    o,
    o2: init.alias ? o : null,
    list: [...init.list],
    map: new Map(init.map),
    set: new Set(init.set),
    d0: 0,
    d1: 0,
    d2: 0,
    version: 0,
    log: [],
    marks: new Map(),
  };
}

function headMatches(on, head) {
  if (listenerKeys.includes(head)) return false;
  if (on === "*") return true;
  if (on === "d") return derived.includes(head);
  return on === head;
}

/** The listener's write for `rule`; `stamp` is a number it counts. */
function applyRule(state, rule, head, stamp) {
  switch (rule.write) {
    case "version": state.version = stamp; break;
    case "bump": state.version++; break;
    case "log": state.log.push(stamp); break;
    case "marks": state.marks.set(head, stamp); break;
    case "a": state.a = stamp % 10; break;
    case "o.q": state.o.q = stamp % 10; break;
    case "list": state.list.push(7); break;
    case "set": state.set.add(stamp % 6); break;
  }
}

function trimTo(state, target, limit) {
  if (target === "list") {
    if (state.list.length > limit) state.list.splice(0, state.list.length - limit);
  } else {
    const collection = state[target];
    while (collection.size > limit) collection.delete(collection.keys().next().value);
  }
}

function clampTo(state, target, limit) {
  if (target.startsWith("o.")) {
    const key = target.slice(2);
    if (state.o[key] > limit) state.o[key] = limit;
  } else if (state[target] > limit) state[target] = limit;
}

function applyWrite(state, write, lib) {
  const { list, map, set, o } = state;
  switch (write.op) {
    case "objectMap.set": state.objectMap.set("k0", { n: write.value }); break;
    case "objectMap.delete": state.objectMap.delete("k0"); break;
    case "objectSet.add": state.objectSet.add({ n: write.value }); break;
    case "objectSet.delete": state.objectSet.delete(lib.toRaw(state.objectSet.values().next().value)); break;
    case "objects.splice": state.objects.splice(0, 1, { n: write.value }); break;
    case "set": state[write.key] = write.value; break;
    case "o.set": o[write.key] = write.value; break;
    case "o.delete": delete o[write.key]; break;
    case "o.replace": state.o = { p: write.p, q: write.q }; break;
    case "list.push": list.push(...write.values); break;
    case "list.pop": list.pop(); break;
    case "list.shift": list.shift(); break;
    case "list.sort": list.sort(); break;
    case "list.reverse": list.reverse(); break;
    case "list.unshift": list.unshift(...write.values); break;
    case "list.splice": list.splice(write.start, write.count, ...write.values); break;
    case "list.index": list[write.index] = write.value; break;
    case "list.length": list.length = write.length; break;
    case "list.replace": state.list = [...write.values]; break;
    case "map.set": map.set(write.key, write.value); break;
    case "map.delete": map.delete(write.key); break;
    case "map.clear": map.clear(); break;
    case "set.add": set.add(write.value); break;
    case "set.delete": set.delete(write.value); break;
    case "set.clear": set.clear(); break;
    case "o.undefined": o.u = undefined; break;
    case "map.getOrInsert":
    case "map.getOrInsertComputed": {
      const method = write.op.slice(4);
      // an engine without the method: the write is skipped on every build
      if (typeof Map.prototype[method] !== "function") return "skipped";
      if (method === "getOrInsert") map.getOrInsert(write.key, write.value);
      else map.getOrInsertComputed(write.key, () => write.value);
      break;
    }
  }
}

/**
 * Run `spec` on `lib`. Returns `log`, every event the replica received and
 * every error a write threw, in order, and `mismatch`, the first point
 * where the replica differed from the source, if any.
 */
export function runCase(lib, spec) {
  const log = [];
  let remote;
  let stamp = 100;
  let state;
  const fire = (event, when) => {
    const head = event.path[0];
    for (const rule of spec.rules) {
      if (rule.when !== when || !headMatches(rule.on, head)) continue;
      applyRule(state, rule, head, ++stamp);
    }
  };
  state = lib.reactive(makeState(spec.init), (event) => {
    if (event.path.length === 0) {
      remote = event.newValue;
      return;
    }
    try {
      fire(event, "before");
    } finally {
      log.push(eventText(lib, event));
      lib.updateState(remote, event);
    }
    fire(event, "after");
  });
  let mismatch;
  const check = (step) => {
    if (mismatch !== undefined) return;
    const source = stateText(lib, state);
    const replica = stateText(lib, remote);
    if (source !== replica) mismatch = { step, source, replica };
  };
  const attempt = (step, run) => {
    try {
      if (run() === "skipped") log.push(`skipped ${step}`);
    } catch (error) {
      log.push(`threw ${error instanceof Error ? error.message : String(error)}`);
    }
    check(step);
  };
  const computed = lib.computed(() => state.a + state.list.length);
  const stops = [];
  spec.effects.forEach((effect, index) => {
    const options = effect.hookThrows ? { onTrigger: () => { throw new Error(`hook ${index}`); } } : {};
    attempt(`effect ${index}`, () => {
      stops.push(lib.watchEffect(() => {
        let value = 0;
        for (const name of effect.reads) value += sources[name].read(state, computed);
        const throws = effect.throwMod > 0 && value % effect.throwMod === effect.throwAt % effect.throwMod;
        if (throws && !effect.throwAfterWrite) throw new Error(`effect ${index}`);
        if (effect.kind === "mirror") state[effect.target] = value % 50;
        else if (effect.kind === "clamp") clampTo(state, effect.target, effect.limit);
        else if (effect.kind === "trim") trimTo(state, effect.target, effect.limit);
        if (throws) throw new Error(`effect ${index}`);
      }, options));
    });
  });
  spec.writes.forEach((write, index) => attempt(`write ${index} ${write.op}`, () => applyWrite(state, write, lib)));
  for (const stop of stops) stop();
  computed.stop?.();
  return { log, mismatch };
}
