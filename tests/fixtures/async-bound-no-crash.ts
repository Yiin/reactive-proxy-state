// Run by tests/review-307.bun.test.ts in its own process, with no
// uncaughtException handler: an async root that stops a listener loop logs
// the RangeError, and the process goes on and exits 0. Prints the outcome
// as JSON.
import type * as Library from "../../src/index";
const { reactive, toRaw } = await import(process.env.RPS_TEST_BUNDLE ?? "../../src/index") as typeof Library;
const logged: string[] = [];
console.error = (...values: unknown[]) => { logged.push(values.map(value => value instanceof Error ? value.message : String(value)).join(" ")); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// A direct chain whose listener catches its refused write.
let armed = true;
const chain: any = reactive({ n: 0 }, event => {
  if (!armed || event.path.length === 0) return;
  try { chain.n++; } catch {}
}, [], { async: true });
await tick();
chain.n = 1;
await tick();

// The same chain, with the refusal thrown out of the listener.
const escaping: any = reactive({ n: 0 }, event => {
  if (armed && event.path.length > 0) escaping.n++;
}, [], { async: true });
await tick();
escaping.n = 1;
await tick();

// Two async roots that write each other: the generation crosses microtasks.
const first: any = reactive({ n: 0 }, event => { if (armed && event.path.length > 0) second.n++; }, [], { async: true });
const second: any = reactive({ n: 0 }, event => { if (armed && event.path.length > 0) first.n++; }, [], { async: true });
await tick();
first.n = 1;
for (let i = 0; i < 120; i++) await tick();

// A later write gets a fresh bound.
armed = false;
const after: any = reactive({ n: 0, version: 0 }, event => {
  if (event.path[0] === "n") after.version++;
}, [], { async: true });
await tick();
after.n = 5;
await tick();

console.log(JSON.stringify({ logged, chain: toRaw(chain).n, escaping: toRaw(escaping).n, pair: toRaw(first).n + toRaw(second).n, after: toRaw(after) }));
