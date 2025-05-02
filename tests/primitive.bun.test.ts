import { expect, test, describe } from "bun:test";
import { reactive, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Primitive Tests", () => {
  test("primitive set emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ value: 42 }, emit);
    
    state.value = 43;

    expect(events.length).toBe(2);

    const setEvent = events.pop()!;
    expect(setEvent.action).toBe('set');
    expect(setEvent.path).toEqual(['value']);
    expect(setEvent.newValue).toBe(43);
    expect(setEvent.oldValue).toBe(42);
  });
}); 