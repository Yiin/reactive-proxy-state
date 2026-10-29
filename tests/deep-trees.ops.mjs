// Deep trees: every store, copy and location walk must work at any depth, as
// 1.0.44 did for root creation and writes at depth. Shared by
// tests/deep-trees.bun.test.ts (Bun, source) and tests/deep-trees.node.mjs
// (Node, a built bundle). Each check returns null when it passes, else what
// went wrong.

/** `{ child: { child: ... leaf } }`, `depth` levels above `leaf`. */
export function chain(depth, leaf = { x: 1 }) {
  let value = leaf;
  for (let i = 0; i < depth; i++) value = { child: value };
  return value;
}

/** The object `depth` levels down a chain. */
function down(value, depth) {
  for (let i = 0; i < depth; i++) value = value.child;
  return value;
}

/** Are two trees equal, walked without recursion? */
export function sameTree(left, right) {
  const pending = [[left, right]];
  while (pending.length > 0) {
    const [a, b] = pending.pop();
    if (a === b) continue;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const key of keys) {
      if (!Object.hasOwn(b, key)) return false;
      pending.push([a[key], b[key]]);
    }
  }
  return true;
}

/** A root whose replica applies every event (payloads are copies already). */
function wire(lib, raw) {
  const result = { state: undefined, remote: undefined, events: [] };
  result.state = lib.reactive(raw, (event) => {
    result.events.push(event);
    if (event.path.length === 0 && event.action === "replace") result.remote = event.newValue;
    else lib.updateState(result.remote, event);
  });
  return result;
}

function inSync(lib, sync) {
  return sameTree(lib.toRaw(sync.state), sync.remote) ? null : "replica differs from state";
}

export const deepChecks = {
  "root, plain tree": (lib, depth) => {
    const raw = chain(depth);
    const sync = wire(lib, raw);
    if (sync.events.length !== 1) return `events ${sync.events.length}`;
    if (sync.remote === raw) return "the initial replace is not a copy";
    if (down(sync.remote, depth).x !== 1) return "copy lost its leaf";
    return inSync(lib, sync);
  },
  "root, alias at the bottom": (lib, depth) => {
    const shared = { n: 0 };
    const sync = wire(lib, { a: chain(depth, { shared }), b: shared });
    if (sync.events.length !== 1) return `events ${sync.events.length}`;
    sync.state.b.n = 1;
    const lengths = sync.events.slice(1).map((event) => event.path.length).sort((x, y) => x - y);
    if (lengths.join() !== `2,${depth + 3}`) return `paths ${lengths}`;
    return inSync(lib, sync);
  },
  "write, deep payload": (lib, depth) => {
    const sync = wire(lib, { x: 0 });
    sync.state.x = chain(depth);
    if (sync.events.length !== 2) return `events ${sync.events.length}`;
    if (down(sync.events[1].newValue, depth).x !== 1) return "payload lost its leaf";
    return inSync(lib, sync);
  },
  "write, deep payload with an alias": (lib, depth) => {
    const shared = { n: 0 };
    const sync = wire(lib, { x: 0 });
    sync.state.x = { a: chain(depth, { shared }), b: shared };
    sync.state.x.b.n = 1;
    if (sync.events.length !== 4) return `events ${sync.events.length}`;
    return inSync(lib, sync);
  },
  "write at the bottom": (lib, depth) => {
    const sync = wire(lib, { root: chain(depth) });
    down(sync.state.root, depth).x = 2;
    const last = sync.events.at(-1);
    if (last.path.length !== depth + 2) return `path ${last.path.length}`;
    return inSync(lib, sync);
  },
  "write at the bottom of an alias": (lib, depth) => {
    const sync = wire(lib, { a: chain(depth), b: 0 });
    sync.state.b = sync.state.a;
    down(sync.state.a, depth).x = 2;
    if (sync.events.length !== 4) return `events ${sync.events.length}`;
    return inSync(lib, sync);
  },
  "delete a deep subtree that was read": (lib, depth) => {
    const sync = wire(lib, { root: chain(depth), keep: 1 });
    const leaf = down(sync.state.root, depth);
    delete sync.state.root;
    leaf.x = 3;
    if (sync.events.length !== 2) return `events ${sync.events.length}`;
    return inSync(lib, sync);
  },
  "push a deep item": (lib, depth) => {
    const sync = wire(lib, { list: [] });
    sync.state.list.push(chain(depth));
    if (sync.events.length !== 2) return `events ${sync.events.length}`;
    if (down(sync.events[1].items[0], depth).x !== 1) return "item lost its leaf";
    return inSync(lib, sync);
  },
};

/** Run every check at `depth`; returns the failures. */
export function runDeepChecks(lib, depth) {
  const failures = [];
  for (const [name, check] of Object.entries(deepChecks)) {
    let problem;
    try {
      problem = check(lib, depth);
    } catch (error) {
      problem = `${error.name}: ${error.message}`;
    }
    if (problem) failures.push(`${name} at depth ${depth}: ${problem}`);
  }
  return failures;
}
