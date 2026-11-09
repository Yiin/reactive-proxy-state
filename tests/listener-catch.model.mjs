// Replica cases where listeners catch an error and attempt another write.
import fc from "fast-check";
import { eventText } from "./event-stream.ops.mjs";
import { stateText } from "./replica-property.model.mjs";

export const listenerCatchArbitrary = fc.record({
  refusal: fc.boolean(),
  depth: fc.integer({ min: 1, max: 8 }),
  retry: fc.constantFrom("property", "map", "list"),
  // A parent can miss an error swallowed by a child, or catch it itself.
  swallow: fc.boolean(),
  rounds: fc.integer({ min: 1, max: 3 }),
  initial: fc.integer({ min: 0, max: 9 }),
});

export function runListenerCatchCase(lib, spec) {
  const log = [];
  let remote;
  let stamp = spec.initial;
  let armed = true;
  let attempts = 0;
  let rejected = 0;
  let caught = 0;
  let callerErrors = 0;
  let mismatch;
  const errorText = error => error instanceof Error ? error.message : String(error);
  const retry = () => {
    attempts++;
    try {
      if (spec.retry === "property") state.after = ++stamp;
      else if (spec.retry === "map") state.map.set("after", ++stamp);
      else state.list.push(++stamp);
    } catch (error) {
      rejected++;
      log.push(`retry threw ${errorText(error)}`);
    }
  };
  const state = lib.reactive({ start: 0, loop: 0, after: spec.initial, map: new Map(), list: [], done: 0 }, event => {
    if (event.path.length === 0) { remote = event.newValue; return; }
    log.push(eventText(lib, event));
    lib.updateState(remote, event);
    if (!armed || (event.path[0] !== "start" && event.path[0] !== "loop")) return;
    const atLeaf = event.path[0] === "loop" && state.loop % spec.depth === 0;
    if (!spec.refusal && atLeaf) throw new Error("listener fault");
    try {
      state.loop++;
    } catch (error) {
      caught++;
      log.push(`caught ${errorText(error)}`);
      // A finally block attempts the write even when the error propagates.
      if (!spec.swallow) throw error;
    } finally {
      retry();
    }
  });
  const check = step => {
    const source = stateText(lib, state);
    const replica = stateText(lib, remote);
    if (source !== replica) mismatch ??= { step, source, replica };
  };
  for (let round = 1; round <= spec.rounds; round++) {
    try { state.start = round; } catch (error) {
      callerErrors++;
      log.push(`caller threw ${errorText(error)}`);
    }
    check(`round ${round}`);
    // A later caller write starts a fresh operation, including after refusal.
    state.done = round;
    check(`recovery ${round}`);
  }
  armed = false;
  retry();
  check("caller retry");
  return {
    log, mismatch, attempts, rejected, caught, callerErrors,
    loop: state.loop, done: state.done,
    retryValue: spec.retry === "property" ? state.after : spec.retry === "map" ? state.map.get("after") : state.list.at(-1),
    source: stateText(lib, state), replica: stateText(lib, remote),
  };
}
