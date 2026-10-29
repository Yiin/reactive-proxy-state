// Run by tests/listener-errors.bun.test.ts in its own process: an error thrown
// on the microtask of an async root reaches `uncaughtException`, which the
// test runner would count as a failure. Prints the outcome as JSON.
import { reactive, toRaw, updateState } from "../../src/index";

const errors: string[] = [];
process.on("uncaughtException", (error) => {
  errors.push(error.message);
});

let remote: any;
const log: string[] = [];
const state: any = reactive(
  { x: 0, y: 0, z: 0 },
  (event) => {
    if (event.path.length === 0) {
      remote = structuredClone(event.newValue);
      return;
    }
    const path = event.path.join(".");
    log.push(path);
    updateState(remote, structuredClone(event));
    if (path === "x" || path === "z") throw new Error(`listener failed on ${path}`);
  },
  [],
  { async: true }
);

await Promise.resolve();
state.x = 1;
state.y = 2;
state.z = 3;
await new Promise((resolve) => setTimeout(resolve, 20));
state.y = 4;
await new Promise((resolve) => setTimeout(resolve, 20));
console.log(JSON.stringify({ errors, log, state: toRaw(state), remote }));
