// Equivalence fuzz for trackVueReactiveEvents: a candidate tracker against a
// reference tracker (2.0.0). Shared by tests/vue3-equivalence.bun.test.ts
// (Bun: the source against the frozen 2.0.0 copy in tests/fixtures) and
// tests/vue3-equivalence.node.mjs (Node: two installed packages).
//
// Two identical Vue reactive states get the same random edits. After every
// edit both trackers must send the same events, a replica fed each tracker's
// events must equal its state, edits made while paused must send nothing, and
// no event may change after it was sent.
//
// Three differences are intended and allowed:
// - 2.0.0 sends a NaN leaf, and a Map value that holds NaN, again on every
//   walk of its root key, also at every resume(). Those repeat sends (old and
//   new value equal) are left out of the comparison on both sides.
// - 2.0.0 compares Map values with deepEqual, which takes a Map, Set, Date or
//   object with no own keys for any other of them, so it misses such a change
//   and its copy goes stale. The candidate sends it. After such an edit the
//   reference tracker and its replica start over from the current state
//   (counted in `referenceMisses`), once the candidate's replica is checked.
// - Delete order inside one diff can differ (deletes name different keys), so
//   events that differ only in order across paths count as `reordered`.
//
// Values: numbers, strings, booleans, null, undefined, NaN, Dates, arrays,
// objects, Maps with string keys and Sets of primitives. Sets of objects and
// object Map keys are left out: 2.0.0 compares them by identity against its
// copies, so it resends them on any walk, which no tracker can match. NaN is
// not a Set member: Vue's dev build warns on every has(NaN).

export function rng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

const pick = (random, count) => Math.floor(random() * count);
const BASE_TIME = Date.UTC(2026, 0, 1);

function makeLeaf(random) {
  switch (pick(random, 9)) {
    case 0: return pick(random, 10);
    case 1: return `s${pick(random, 5)}`;
    case 2: return random() < 0.5;
    case 3: return null;
    case 4: return pick(random, 3);
    case 5: return random() < 0.3 ? Number.NaN : pick(random, 4);
    case 6: return new Date(BASE_TIME + pick(random, 4) * 1000);
    case 7: return random() < 0.3 ? undefined : pick(random, 4);
    default: return `s${pick(random, 2)}`;
  }
}

function makeMember(random) {
  switch (pick(random, 5)) {
    case 0: return pick(random, 6);
    case 1: return `v${pick(random, 4)}`;
    case 2: return 7;
    case 3: return null;
    default: return true;
  }
}

export function makeValue(random, depth) {
  const roll = random();
  if (depth > 3 || roll < 0.42) return makeLeaf(random);
  if (roll < 0.64) return Array.from({ length: pick(random, 5) }, () => makeValue(random, depth + 1));
  if (roll < 0.88) {
    const object = {};
    const count = pick(random, 5);
    for (let index = 0; index < count; index++) object[`k${pick(random, 8)}`] = makeValue(random, depth + 1);
    return object;
  }
  if (roll < 0.95) {
    const map = new Map();
    const count = pick(random, 4);
    for (let index = 0; index < count; index++) map.set(`m${pick(random, 4)}`, makeValue(random, depth + 1));
    return map;
  }
  const set = new Set();
  const count = pick(random, 4);
  for (let index = 0; index < count; index++) set.add(makeMember(random));
  return set;
}

/** Deterministic text of a value: sorted object keys, Map and Set entries, NaN, -0, undefined and Dates kept apart. */
export function canon(value, toRaw) {
  if (value === undefined) return "u";
  if (typeof value === "number") return Number.isNaN(value) ? "NaN" : Object.is(value, -0) ? "-0" : `n${value}`;
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || typeof value !== "object") return String(value);
  const raw = toRaw(value);
  if (raw instanceof Date) return `D${raw.getTime()}`;
  if (Array.isArray(raw)) {
    const parts = [];
    for (let index = 0; index < raw.length; index++) parts.push(index in raw ? canon(raw[index], toRaw) : "hole");
    return `[${parts.join(",")}]`;
  }
  if (raw instanceof Map) return `M{${[...raw].map(([key, entry]) => `${canon(key, toRaw)}:${canon(entry, toRaw)}`).sort().join(",")}}`;
  if (raw instanceof Set) return `S{${[...raw].map((entry) => canon(entry, toRaw)).sort().join(",")}}`;
  return `{${Object.keys(raw).sort().map((key) => `${JSON.stringify(key)}:${canon(raw[key], toRaw)}`).join(",")}}`;
}

/** Plain deep copy through raw objects; raw objects can hold proxies (an array that filter() returned). */
export function rawCopy(value, toRaw) {
  if (value === null || typeof value !== "object") return value;
  const raw = toRaw(value);
  if (raw instanceof Date) return new Date(raw.getTime());
  if (Array.isArray(raw)) return Array.from(raw, (entry) => rawCopy(entry, toRaw));
  if (raw instanceof Map) return new Map([...raw].map(([key, entry]) => [rawCopy(key, toRaw), rawCopy(entry, toRaw)]));
  if (raw instanceof Set) return new Set([...raw].map((entry) => rawCopy(entry, toRaw)));
  const copy = {};
  for (const key of Object.keys(raw)) copy[key] = rawCopy(raw[key], toRaw);
  return copy;
}

/** Every container path in a plain tree; Map values are reached by key. */
function containers(value, path = [], out = []) {
  if (value === null || typeof value !== "object" || value instanceof Date) return out;
  out.push(path);
  if (Array.isArray(value)) value.forEach((child, index) => containers(child, [...path, index], out));
  else if (value instanceof Map) for (const [key, child] of value) containers(child, [...path, key], out);
  else if (!(value instanceof Set)) for (const key of Object.keys(value)) containers(value[key], [...path, key], out);
  return out;
}

function at(root, path) {
  let node = root;
  for (const key of path) node = node instanceof Map ? node.get(key) : node[key];
  return node;
}

/** One random edit, as a function that applies it to a reactive root through its proxy. */
function makeEdit(random, plain, toRaw) {
  const paths = containers(plain);
  const path = paths[pick(random, paths.length)];
  const target = at(plain, path);
  const value = makeValue(random, 1);
  const value2 = makeValue(random, 2);
  const member = makeMember(random);
  if (target instanceof Set) {
    const members = [...target];
    const existing = members.length ? members[pick(random, members.length)] : member;
    const choice = pick(random, 7);
    return labelled(`set ${choice} at ${JSON.stringify(path)}`, (root) => {
      const set = at(root, path);
      if (!(set instanceof Set)) return;
      if (choice < 4) set.add(member);
      else if (choice < 6) set.delete(existing);
      else set.clear();
    });
  }
  if (target instanceof Map) {
    const keys = [...target.keys()];
    const key = random() < 0.6 && keys.length ? keys[pick(random, keys.length)] : `m${pick(random, 4)}`;
    const choice = pick(random, 8);
    return labelled(`map ${choice} ${key} at ${JSON.stringify(path)}`, (root) => {
      const map = at(root, path);
      if (!(map instanceof Map)) return;
      if (choice < 4) map.set(key, structuredClone(value));
      else if (choice < 6) map.delete(key);
      else if (choice === 6) {
        // replace with an equal copy: new identity, same content
        if (map.has(key)) map.set(key, structuredClone(rawCopy(map.get(key), toRaw)));
      } else map.clear();
    });
  }
  if (Array.isArray(target)) {
    const index = pick(random, target.length + 1);
    const choice = pick(random, 11);
    return labelled(`array ${choice} ${index} at ${JSON.stringify(path)}`, (root) => {
      const array = at(root, path);
      // A remote batch's later edit can find another type where the snapshot had an array.
      if (!Array.isArray(array)) return;
      switch (choice) {
        case 0: array.push(structuredClone(value)); break;
        case 1: array.pop(); break;
        case 2: array.shift(); break;
        case 3: array.unshift(structuredClone(value)); break;
        case 4: array.splice(index, 1 + (index % 2), structuredClone(value)); break;
        case 5: array.reverse(); break;
        case 6: array.length = Math.floor(array.length / 2); break;
        case 7: array[Math.min(index, array.length)] = structuredClone(value); break;
        case 8: {
          // move an item: same object, new index
          if (array.length > 1) {
            const [item] = array.splice(0, 1);
            array.splice(Math.min(index, array.length), 0, item);
          }
          break;
        }
        case 9: {
          // reassign a filtered copy at the parent (same item objects, new array)
          if (path.length === 0) break;
          const parent = at(root, path.slice(0, -1));
          const filtered = array.filter((_, position) => position % 2 === 0);
          if (parent instanceof Map) parent.set(path.at(-1), filtered);
          else parent[path.at(-1)] = filtered;
          break;
        }
        default:
          array.sort((left, right) => canon(left, toRaw).localeCompare(canon(right, toRaw)));
      }
    });
  }
  const keys = Object.keys(target);
  const key = random() < 0.6 && keys.length ? keys[pick(random, keys.length)] : `k${pick(random, 8)}`;
  const choice = pick(random, 6);
  return labelled(`object ${choice} ${key} at ${JSON.stringify(path)}`, (root) => {
    const object = at(root, path);
    if (object === null || typeof object !== "object" || Array.isArray(object) || object instanceof Map || object instanceof Set) return;
    switch (choice) {
      case 0: delete object[key]; break;
      case 1: object[key] = structuredClone(value2); break;
      case 2: {
        // replace with an equal copy: new identity, same content
        if (key in object) object[key] = structuredClone(rawCopy(object[key], toRaw));
        break;
      }
      case 3: {
        // move a child to another key of the same object
        const other = keys.find((candidate) => candidate !== key);
        if (other) {
          object[key] = object[other];
          delete object[other];
        }
        break;
      }
      default: object[key] = structuredClone(value);
    }
  });
}

function labelled(label, edit) {
  edit.label = label;
  return edit;
}

/** 2.0.0's repeat send of a value that did not change (a NaN leaf, a Map value holding NaN). */
function isRepeatSend(event, toRaw) {
  if (!("oldValue" in event)) return false;
  if (event.action === "set") return Number.isNaN(event.oldValue) && Number.isNaN(event.newValue);
  if (event.action === "map-set") return canon(event.oldValue, toRaw) === canon(event.newValue, toRaw);
  return false;
}

/** A candidate map-set for a change 2.0.0's deepEqual cannot see. */
function isMissedByReference(event, toRaw, deepEqual) {
  return (
    event.action === "map-set" &&
    "oldValue" in event &&
    canon(event.oldValue, toRaw) !== canon(event.newValue, toRaw) &&
    deepEqual(event.newValue, event.oldValue, new WeakMap())
  );
}

/**
 * Runs `seeds` random histories of `ops` edits each.
 * lib: { reactive, toRaw, updateState, deepEqual }: the Vue reactive() and toRaw() that both trackers
 * see, an updateState for replicas, and 2.0.0's deepEqual.
 * reference, candidate: trackVueReactiveEvents functions.
 */
export function runEquivalenceFuzz({ lib, reference, candidate, seeds, ops, firstSeed = 1, maxFailures = 3 }) {
  const { reactive, toRaw, updateState, deepEqual } = lib;
  const failures = [];
  let reordered = 0;
  let editsChecked = 0;
  let eventsChecked = 0;
  let pausedEdits = 0;
  let referenceMisses = 0;
  for (let seed = firstSeed; seed < firstSeed + seeds && failures.length < maxFailures; seed++) {
    const random = rng(seed * 7919);
    const base = { accounts: { 1: makeValue(random, 0), 2: { list: [makeValue(random, 1), makeValue(random, 1)] } }, nextJobId: 1 };
    const states = [reactive(structuredClone(base)), reactive(structuredClone(base))];
    const replicas = [structuredClone(base), structuredClone(base)];
    const emitted = [[], []];
    const sentText = [[], []];
    const errors = [[], []];
    const startTracker = (side) =>
      [reference, candidate][side](
        states[side],
        (event) => {
          emitted[side].push(event);
          sentText[side].push(canon(event, toRaw));
        },
        { emitInitialReplace: false, onDiffError: (context) => errors[side].push(String(context.error)) }
      );
    const trackers = [startTracker(0), startTracker(1)];
    for (let op = 0; op < ops; op++) {
      const plain = rawCopy(states[0], toRaw);
      const paused = random() < 0.3;
      const edits = Array.from({ length: paused ? 1 + pick(random, 4) : 1 }, () => makeEdit(random, plain, toRaw));
      for (let side = 0; side < 2; side++) {
        emitted[side].length = 0;
        sentText[side].length = 0;
        if (paused) trackers[side].pause();
        try {
          for (const edit of edits) {
            try {
              edit(states[side]);
            } catch {
              // a later edit of a paused batch can name a path an earlier one removed
            }
          }
        } finally {
          if (paused) trackers[side].resume();
        }
      }
      editsChecked += 1;
      if (paused) pausedEdits += 1;
      const problems = [];
      const missed = emitted[1].filter((event) => isMissedByReference(event, toRaw, deepEqual));
      const compared = emitted.map((events) =>
        events.filter((event) => !isRepeatSend(event, toRaw) && !missed.includes(event)).map((event) => canon(event, toRaw))
      );
      eventsChecked += compared[1].length;
      for (let side = 0; side < 2; side++) {
        if (errors[side].length) problems.push(`${side ? "candidate" : "reference"} reported ${errors[side][0]}`);
        if (emitted[side].some((event, index) => canon(event, toRaw) !== sentText[side][index])) {
          problems.push(`${side ? "candidate" : "reference"} changed an event after sending it`);
        }
      }
      if (paused && compared[1].length) problems.push("paused edit emitted");
      if (compared[0].join("\n") !== compared[1].join("\n")) {
        if ([...compared[0]].sort().join("\n") === [...compared[1]].sort().join("\n")) reordered += 1;
        else problems.push("events differ");
      }
      for (let side = 0; side < 2; side++) {
        if (paused) replicas[side] = rawCopy(states[side], toRaw);
        else for (const event of emitted[side]) updateState(replicas[side], structuredClone(rawCopy(event, toRaw)));
        const replicaText = canon(replicas[side], toRaw);
        const stateText = canon(states[side], toRaw);
        if (replicaText !== stateText && !(side === 0 && missed.length)) {
          let at = 0;
          while (replicaText[at] === stateText[at]) at++;
          const around = (text) => text.slice(Math.max(0, at - 80), at + 80);
          problems.push(`${side ? "candidate" : "reference"} replica diverged: replica …${around(replicaText)}… state …${around(stateText)}…`);
        }
      }
      if (canon(states[0], toRaw) !== canon(states[1], toRaw)) problems.push("states differ");
      if (missed.length && !problems.length) {
        referenceMisses += 1;
        trackers[0].stop();
        trackers[0] = startTracker(0);
        replicas[0] = rawCopy(states[0], toRaw);
      }
      if (problems.length) {
        failures.push({
          seed,
          op,
          paused,
          problems,
          edits: edits.map((edit) => edit.label),
          before: canon(plain, toRaw).slice(0, 400),
          reference: emitted[0].slice(0, 6).map((event) => canon(event, toRaw)),
          candidate: emitted[1].slice(0, 6).map((event) => canon(event, toRaw)),
        });
        break;
      }
    }
    trackers.forEach((tracker) => tracker.stop());
  }
  return { seeds, opsPerSeed: ops, editsChecked, pausedEdits, eventsChecked, reordered, referenceMisses, failures };
}
