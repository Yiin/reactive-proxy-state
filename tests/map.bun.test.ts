import { expect, test, describe } from "bun:test";
import { reactive, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Map Tests", () => {
  test("map-set emits event", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ map: new Map([['a', 1]]) }, emit);
    
    state.map.set('b', 2);
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('map-set');
    expect(events[0].path).toEqual(['map']);
    expect(events[0].key).toBe('b');
    expect(events[0].oldValue).toBe(undefined);
    expect(events[0].newValue).toBe(2);
  });

  test("reactive handles nested maps", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({
      map: new Map([
        ['a', new Map([['x', 1]])]
      ])
    }, emit);
    
    state.map.get('a')!.set('y', 2);
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('map-set');
    expect(events[0].path).toEqual(['map', 'a']);
    expect(events[0].key).toBe('y');
    expect(events[0].oldValue).toBe(undefined);
    expect(events[0].newValue).toBe(2);
  });

  test("map methods emit correct events", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ map: new Map([['a', 1], ['b', 2]]) }, emit);
    
    state.map.delete('a');
    state.map.set('c', 3);
    
    expect(events.length).toBe(2);
    expect(events[0].action).toBe('map-delete');
    expect(events[0].path).toEqual(['map']);
    expect(events[0].key).toBe('a');
    expect(events[0].oldValue).toBe(1);
    expect(events[1].action).toBe('map-set');
    expect(events[1].path).toEqual(['map']);
    expect(events[1].key).toBe('c');
    expect(events[1].oldValue).toBe(undefined);
    expect(events[1].newValue).toBe(3);
  });
}); 