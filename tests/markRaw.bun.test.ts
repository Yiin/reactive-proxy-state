// @ts-nocheck
import { expect, test, describe } from "bun:test";
import { reactive, markRaw, isReactive, watchEffect, StateEvent, EmitFunction } from '../src/index';

// Helper to collect emitted events
function createEventCollector(): { events: StateEvent[]; emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("markRaw Utility", () => {
  test("markRaw object is not made reactive when passed directly to reactive", () => {
    const original = markRaw({ foo: 1 });
    const observed = reactive(original);

    // Should return the same reference and not be reactive
    expect(observed).toBe(original);
    expect(isReactive(observed)).toBe(false);

    // Mutating should not throw or emit events
    original.foo = 2;
    expect(original.foo).toBe(2);
  });

  test("nested markRaw object inside reactive state stays raw and does not emit events", () => {
    const { events, emit } = createEventCollector();
    const rawChild = markRaw({ value: 1 });

    const parent = reactive({ child: rawChild }, emit);

    // Clear initial replace event
    events.length = 0;

    // Mutate the raw child directly
    rawChild.value = 2;

    // No new events should be emitted because the mutation is invisible to the reactive system
    expect(events.length).toBe(0);
  });

  test("mutations on markRaw child do not retrigger watchEffect", () => {
    const rawChild = markRaw({ counter: 0 });
    const state = reactive({ child: rawChild });

    let runCount = 0;
    watchEffect(() => {
      // Access nested property – .child is tracked, .counter is not
      state.child.counter;
      runCount++;
    });

    expect(runCount).toBe(1);

    // Update the raw child's property – should NOT trigger the effect
    rawChild.counter = 1;
    expect(runCount).toBe(1);

    // Updating the reactive reference should trigger the effect
    state.child = markRaw({ counter: 5 });
    expect(runCount).toBe(2);
  });
}); 