import { expect, test, describe } from "bun:test";
import { reactive, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Set Tests", () => {
  test("set-add emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ set: new Set([1, 2]) }, emit);
    
    state.set.add(3);
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set-add');
    expect(events[0].path).toEqual(['set']);
    expect(events[0].value).toBe(3);
    expect(events[0].oldValue).toBe(undefined);
  });

  test("reactive handles nested sets", () => {
    const { events, emit } = createEventCollector();
    const innerSet = new Set([1, 2]);
    const state = reactive({ set: new Set([innerSet]) }, emit);
    
    state.set.values().next().value!.add(3);
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set-add');
    expect(events[0].path).toEqual(['set', '0']);
    expect(events[0].value).toBe(3);
    expect(events[0].oldValue).toBe(undefined);
  });

  test("set methods emit correct events", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ set: new Set([1, 2, 3]) }, emit);
    
    state.set.delete(2);
    state.set.add(4);
    
    expect(events.length).toBe(2);
    expect(events[0].action).toBe('set-delete');
    expect(events[0].path).toEqual(['set']);
    expect(events[0].value).toBe(2);
    expect(events[0].oldValue).toBe(2);
    expect(events[1].action).toBe('set-add');
    expect(events[1].path).toEqual(['set']);
    expect(events[1].value).toBe(4);
    expect(events[1].oldValue).toBe(undefined);
  });
}); 