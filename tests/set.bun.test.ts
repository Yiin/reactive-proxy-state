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
    
    expect(events.length).toBe(2);
    expect(events[1]).toEqual({ action: 'set-add', path: ['set'], value: 3 });
  });

  test("reactive handles nested sets", () => {
    const { events, emit } = createEventCollector();
    const innerSet = new Set([1, 2]);
    const state = reactive({ set: new Set([innerSet]) }, emit);
    
    state.set.values().next().value!.add(3);
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set-add');
    expect(events[1].path).toEqual(['set', '0']);
    expect(events[1].value).toBe(3);
  });

  test("set methods emit correct events", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ set: new Set([1, 2, 3]) }, emit);
    
    state.set.delete(2);
    state.set.add(4);
    
    expect(events.length).toBe(3);
    const deleteEvent = events[1];
    expect(deleteEvent.action).toBe('set-delete');
    expect(deleteEvent.path).toEqual(['set']);
    expect(deleteEvent.value).toBe(2);
    expect(deleteEvent.oldValue).toBe(2);
    expect(events[2]).toEqual({ action: 'set-add', path: ['set'], value: 4 });
  });
}); 