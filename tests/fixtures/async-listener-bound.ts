import type * as Library from "../../src/index";
const { reactive, updateState, toRaw } = await import(process.env.RPS_TEST_BUNDLE ?? "../../src/index") as typeof Library;
const errors: string[] = [];
process.on("uncaughtException", error => { errors.push(error.message); });
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
console.log(JSON.stringify({ errors, state: toRaw(state), remote }));
