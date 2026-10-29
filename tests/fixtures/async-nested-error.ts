import { strict as assert } from "node:assert";
const imported = await import(process.env.RPS_LIB ?? "../../src/index.ts");
const { reactive, updateState, toRaw } = imported.default ?? imported;
let remote: any;
let caught = false;
const log: string[] = [];
const state: any = reactive({ x: 0, z: 0, last: 0 }, (event: any) => {
  if (!event.path.length) { remote = event.newValue; return; }
  updateState(remote, event);
  log.push(event.path[0]);
  if (event.path[0] === "x") {
    state.z = 1;
    throw new Error("first");
  }
  if (event.path[0] === "z") {
    state.last = 1;
    throw new Error("second");
  }
}, [], { async: true });
process.on("uncaughtException", (error) => {
  assert.equal(caught, false);
  caught = true;
  assert.equal(error.message, "first");
  assert.deepEqual(remote, toRaw(state));
  assert.deepEqual(log, ["x", "z", "last"]);
});
await Promise.resolve();
state.x = 1;
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(caught, true);
console.log("nested events delivered before the error");
