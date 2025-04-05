import { expect, test, describe } from "bun:test";
import { reactive, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Object Tests", () => {
  test("deep mutation in object", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({
      nested: {
        deep: {
          value: 42
        }
      }
    }, emit);
    
    state.nested.deep.value = 43;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path).toEqual(['nested', 'deep', 'value']);
    expect(events[0].newValue).toBe(43);
  });

  test("reactive handles nested object creation", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ obj: {} as any }, emit);
    
    state.obj.nested = { value: 42 };
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path).toEqual(['obj', 'nested']);
    expect(events[0].newValue).toEqual({ value: 42 });
  });

  test("reactive handles property deletion", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ obj: { prop: 42 } as any }, emit);
    
    delete state.obj.prop;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('delete');
    expect(events[0].path).toEqual(['obj', 'prop']);
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
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('delete');
    expect(events[0].path).toEqual(['nested', 'deep', 'value']);
  });

  test("reactive handles circular references", () => {
    const { events, emit } = createEventCollector();
    const obj: any = { value: 42 };
    obj.self = obj;
    const state = reactive({ obj }, emit);
    
    state.obj.value = 43;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path).toEqual(['obj', 'value']);
    expect(events[0].newValue).toBe(43);
  });
}); 