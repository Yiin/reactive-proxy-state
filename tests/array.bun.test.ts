import { expect, test, describe } from "bun:test";
import { wrapState, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Array Tests", () => {
  test("array push emits event", () => {
    const { events, emit } = createEventCollector();
    const state = wrapState({ arr: [1, 2] }, emit);
    
    state.arr.push(3);
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('array-push');
    expect(events[0].path).toEqual(['arr']);
    expect(events[0].key).toBe(2);
    expect(events[0].items).toEqual([3]);
  });

  test("wrapState handles nested arrays", () => {
    const { events, emit } = createEventCollector();
    const state = wrapState({ arr: [[1, 2], [3, 4]] }, emit);
    
    state.arr[0][1] = 5;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path).toEqual(['arr', '0', '1']);
    expect(events[0].newValue).toBe(5);
  });

  test("array methods emit correct events", () => {
    const { events, emit } = createEventCollector();
    const state = wrapState({ arr: [1, 2, 3] }, emit);
    
    state.arr.splice(1, 1, 4, 5);
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('array-splice');
    expect(events[0].path).toEqual(['arr']);
    expect(events[0].key).toBe(1);
    expect(events[0].deleteCount).toBe(1);
    expect(events[0].items).toEqual([4, 5]);
    expect(events[0].oldValues).toEqual([2]);
  });
}); 