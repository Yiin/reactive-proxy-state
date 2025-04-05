import { expect, test, describe } from "bun:test";
import { reactive, updateState, StateEvent, EmitFunction } from '../src/index';

// Helper function to create an event emitter that collects events
function createEventCollector(): { events: StateEvent[], emit: EmitFunction } {
  const events: StateEvent[] = [];
  const emit: EmitFunction = (event) => events.push(event);
  return { events, emit };
}

describe("Edge Cases", () => {
  test("reactive handles Symbol properties", () => {
    const { events, emit } = createEventCollector();
    const sym = Symbol('test');
    const state = reactive({ [sym]: 'value' }, emit);
    
    state[sym] = 'new value';
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('Symbol(test)');
    expect(events[0].newValue).toBe('new value');
  });

  test("reactive handles BigInt values", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ big: 123n }, emit);
    
    state.big = 456n;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('big');
    expect(events[0].newValue).toBe(456n);
  });

  test("reactive handles TypedArrays", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ arr: new Uint8Array([1, 2, 3]) }, emit);
    
    state.arr[0] = 5;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('arr');
    expect(events[0].path[1]).toBe('0');
    expect(events[0].newValue).toBe(5);
  });

  test("reactive handles rapid mutations", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    
    for (let i = 0; i < 100; i++) {
      state.count = i;
    }
    
    expect(events.length).toBe(99);
    expect(events[98].action).toBe('set');
    expect(events[98].path[0]).toBe('count');
    expect(events[98].newValue).toBe(99);
  });

  test("reactive handles nested frozen objects", () => {
    const { events, emit } = createEventCollector();
    const frozen = Object.freeze({ value: 42 });
    const state = reactive({ frozen }, emit);
    
    // This should throw
    expect(() => {
      (state.frozen as any).value = 43;
    }).toThrow();
  });

  test("reactive handles getters and setters", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({
      get value() { return (this as any)._value; },
      set value(v) { (this as any)._value = v; },
      _value: 42
    }, emit);
    
    state.value = 43;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('_value');
    expect(events[0].newValue).toBe(43);
  });

  test("reactive handles non-enumerable properties", () => {
    const { events, emit } = createEventCollector();
    const obj = {} as { hidden?: number };
    Object.defineProperty(obj, 'hidden', {
      value: 42,
      enumerable: false
    });
    
    const state = reactive({ obj }, emit);

    // Expect setting a non-writable property in strict mode to throw
    expect(() => {
      state.obj.hidden = 43;
    }).toThrow(TypeError);

    // Assertions after the throw:
    expect(events.length).toBe(0); // No event should have been emitted before the throw
    expect((state.obj as any).hidden).toBe(42); // Value should remain unchanged
  });

  test("reactive handles prototype chain modifications", () => {
    const { events, emit } = createEventCollector();
    const proto = { inherited: 42 };
    const obj = Object.create(proto);
    const state = reactive({ obj }, emit);
    
    state.obj.inherited = 43;
    
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('obj');
    expect(events[0].path[1]).toBe('inherited');
    expect(events[0].newValue).toBe(43);
  });

  test("reactive handles Symbol.toStringTag", () => {
    const { events, emit } = createEventCollector();
    class CustomClass {
      get [Symbol.toStringTag]() {
        return 'CustomClass';
      }
    }
    
    const state = reactive({ custom: new CustomClass() }, emit);
    expect(Object.prototype.toString.call(state.custom)).toBe('[object CustomClass]');
  });

  test("reactive handles concurrent mutations", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({
      a: { value: 1 },
      b: { value: 2 }
    }, emit);
    
    // Simulate concurrent mutations
    state.a.value = 3;
    state.b.value = 4;
    
    expect(events.length).toBe(2);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('a');
    expect(events[0].path[1]).toBe('value');
    expect(events[0].newValue).toBe(3);
    expect(events[1].action).toBe('set');
    expect(events[1].path[0]).toBe('b');
    expect(events[1].path[1]).toBe('value');
    expect(events[1].newValue).toBe(4);
  });

  test("reactive handles mutations during event processing", () => {
    const events: StateEvent[] = [];
    const emit: EmitFunction = (event) => {
      state.value = 999; // Modify during event processing
      events.push(event);
    };
    const state = reactive({ value: 1 }, emit);
    
    state.value = 2;
    
    expect(events.length).toBe(2);
    expect(events[0].action).toBe('set');
    expect(events[0].path[0]).toBe('value');
    expect(events[0].newValue).toBe(999);
    expect(events[1].action).toBe('set');
    expect(events[1].path[0]).toBe('value');
    expect(events[1].newValue).toBe(2);
  });
}); 