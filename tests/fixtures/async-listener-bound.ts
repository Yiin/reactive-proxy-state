// Run by tests/review-306.bun.test.ts in its own process: an async root
// logs the listener bound's error and never throws it out of the
// microtask. Prints the outcome as JSON.
import type * as Library from "../../src/index";
const { reactive, updateState, toRaw } = await import(process.env.RPS_TEST_BUNDLE ?? "../../src/index") as typeof Library;
const uncaught: string[] = [];
const logged: string[] = [];
process.on("uncaughtException", error => { uncaught.push(error.message); });
console.error = (...values: unknown[]) => { logged.push(values.map(value => value instanceof Error ? value.message : String(value)).join(" ")); };
let armed = false;
let remote: object = {};
const state = reactive({ n: 0, other: 0 }, event => {
  if (!event.path.length) { remote = event.newValue; return; }
  updateState(remote, event);
  if (armed) { state.n++; state.other++; }
}, [], { async: true });
await new Promise(resolve => setTimeout(resolve, 0));
armed = true;
state.n = 1;
await new Promise(resolve => setTimeout(resolve, 0));
armed = false;
state.other = 200;
await new Promise(resolve => setTimeout(resolve, 0));
console.log(JSON.stringify({ uncaught, logged, state: toRaw(state), remote }));
