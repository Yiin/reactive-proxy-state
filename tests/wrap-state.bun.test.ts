import { expect, test, describe } from "bun:test";
import { reactive, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Wrap State Tests", () => {
  test("reactive handles Date objects", () => {
    const { events, emit } = createEventCollector();
    const date = new Date('2024-01-01');
    const state = reactive({ date }, emit);
    
    state.date = new Date('2024-01-02');
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['date']);
    expect(events[1].newValue).toEqual(new Date('2024-01-02'));
  });

  test("reactive handles deep equality check", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ obj: { value: 42 } }, emit);
    
    state.obj = { value: 42 }; // Same value, should not emit
    state.obj = { value: 43 }; // Different value, should emit
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['obj']);
    expect(events[1].newValue).toEqual({ value: 43 });
  });

  test("reactive handles nested object creation", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ obj: {} as any }, emit);
    
    state.obj.nested = { value: 42 };
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['obj', 'nested']);
    expect(events[1].newValue).toEqual({ value: 42 });
  });

  test("reactive handles property deletion", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ obj: { prop: 42 } as any }, emit);
    
    delete state.obj.prop;
    
    expect(events.length).toBe(2);
    const deleteEvent = events[1];
    expect(deleteEvent.action).toBe('delete');
    expect(deleteEvent.path).toEqual(['obj', 'prop']);
    expect(deleteEvent.oldValue).toBe(42);
  });

  test("reactive handles nested property deletion", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({
      nested: {
        deep: {
          value: 42
        }
      } as any
    }, emit);
    
    delete state.nested.deep.value;
    
    expect(events.length).toBe(2);
    const deleteEvent2 = events[1];
    expect(deleteEvent2.action).toBe('delete');
    expect(deleteEvent2.path).toEqual(['nested', 'deep', 'value']);
    expect(deleteEvent2.oldValue).toBe(42);
  });

  test("reactive handles circular references", () => {
    const { events, emit } = createEventCollector();
    const obj: any = { value: 42 };
    obj.self = obj;
    const state = reactive({ obj }, emit);
    
    state.obj.value = 43;
    
    expect(events.length).toBe(2);
    const setEvent = events[1];
    expect(setEvent.action).toBe('set');
    expect(setEvent.path).toEqual(['obj', 'value']);
    expect(setEvent.newValue).toBe(43);
    expect(setEvent.oldValue).toBe(42);
  });
}); 