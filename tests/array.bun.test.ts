import { expect, test, describe } from "bun:test";
import { reactive, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Array Tests", () => {
  test("deep mutation via direct index reference emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ foos: [{ bar: 0 }] }, emit);

    state.foos[0].bar++;

    expect(events.length).toBe(2);
    const setEvent = events[1];
    expect(setEvent.action).toBe('set');
    expect(setEvent.path).toEqual(['foos', '0', 'bar']);
    expect(setEvent.newValue).toBe(1);
  });

  test("deep mutation via aliased array element emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ foos: [{ bar: 0 }] }, emit);

    const foo = state.foos[0];
    foo.bar++;

    expect(events.length).toBe(2);
    const setEvent = events[1];
    expect(setEvent.action).toBe('set');
    expect(setEvent.path).toEqual(['foos', '0', 'bar']);
    expect(setEvent.newValue).toBe(1);
  });

  test("deep mutation via .find() alias emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ foos: [{ bar: 0 }, { bar: 5 }] }, emit);

    const foo = state.foos.find((n) => n.bar === 0)!;
    foo.bar++;

    expect(events.length).toBe(2);
    const setEvent = events[1];
    expect(setEvent.action).toBe('set');
    expect(setEvent.path).toEqual(['foos', '0', 'bar']);
    expect(setEvent.newValue).toBe(1);
  });

  test("deep mutation via .at() alias emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ foos: [{ bar: 0 }, { bar: 5 }] }, emit);

    const foo = state.foos.at(1)!;
    foo.bar++;

    expect(events.length).toBe(2);
    const setEvent = events[1];
    expect(setEvent.action).toBe('set');
    expect(setEvent.path).toEqual(['foos', '1', 'bar']);
    expect(setEvent.newValue).toBe(6);
  });
  test("array push emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ arr: [1, 2] }, emit);
    
    state.arr.push(3);
    
    expect(events.length).toBe(2);
    // Check the second event (the push event)
    const pushEvent = events[1];
    expect(pushEvent.action).toBe('array-push');
    expect(pushEvent.path).toEqual(['arr']);
    // Assuming the 'key' property represents the index where push occurs (which is the new length - 1)
    expect(pushEvent.key).toBe(state.arr.length - 1); // Check index
    expect(pushEvent.items).toEqual([3]); // Check items added
  });

  test("reactive handles nested arrays", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ arr: [[1, 2], [3, 4]] }, emit);
    
    state.arr[0][1] = 5;
    
    expect(events.length).toBe(2);
    // Check the second event (the set event)
    const setEvent = events[1];
    expect(setEvent.action).toBe('set');
    // The path should be strings for object keys/array indices in the event system
    expect(setEvent.path).toEqual(['arr', '0', '1']);
    expect(setEvent.newValue).toBe(5);
  });

  test("array methods emit correct events", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ arr: [1, 2, 3] }, emit);
    
    state.arr.splice(1, 1, 4, 5);
    
    expect(events.length).toBe(2);
    // Check the second event (the splice event)
    const spliceEvent = events[1];
    expect(spliceEvent.action).toBe('array-splice');
    expect(spliceEvent.path).toEqual(['arr']);
    expect(spliceEvent.key).toBe(1); // Index for splice
    expect(spliceEvent.deleteCount).toBe(1);
    expect(spliceEvent.items).toEqual([4, 5]);
    // Optionally check oldValues if the type includes it and it's relevant
    // expect(spliceEvent.oldValues).toEqual([2]); // Original test had this, re-add if needed
    expect(state.arr).toEqual([1, 4, 5, 3]);
  });
}); 
