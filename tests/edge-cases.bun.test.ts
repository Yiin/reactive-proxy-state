import { expect, test, describe } from "bun:test";
import { reactive, updateState, StateEvent, EmitFunction, toRefs } from '../src/index';

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
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['Symbol(test)']);
    expect(events[1].newValue).toBe('new value');
  });

  test("reactive handles BigInt values", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ big: 123n }, emit);
    
    state.big = 456n;
    
    expect(events.length).toBe(2);
    const setEventBigInt = events[1];
    expect(setEventBigInt.action).toBe('set');
    expect(setEventBigInt.path).toEqual(['big']);
    expect(setEventBigInt.newValue).toBe(456n);
  });

  test("reactive handles TypedArrays", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ arr: new Uint8Array([1, 2, 3]) }, emit);
    
    state.arr[0] = 5;
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['arr', '0']);
    expect(events[1].newValue).toBe(5);
  });

  test("reactive handles rapid mutations", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    
    for (let i = 0; i < 100; i++) {
      state.count = i;
    }
    
    expect(events.length).toBe(100);
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
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['_value']);
    expect(events[1].newValue).toBe(43);
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
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('replace');
  });

  test("reactive handles prototype chain modifications", () => {
    const { events, emit } = createEventCollector();
    const proto = { inherited: 42 };
    const obj = Object.create(proto);
    const state = reactive({ obj }, emit);
    
    state.obj.inherited = 43;
    
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['obj', 'inherited']);
    expect(events[1].newValue).toBe(43);
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
    
    expect(events.length).toBe(3);
  });

  test("reactive handles mutations during event processing", () => {
    const events: StateEvent[] = [];
    // Declare state variable first with an initial value
    let state: any = { value: 1 };
    const emit: EmitFunction = (event) => {
      state.value = 999; // Modify during event processing
      events.push(event);
    };
    // Now assign the reactive state to the variable
    state = reactive({ value: 1 }, emit);
    
    state.value = 2;
    
    // The events include:
    // 1. Initial 'replace' event from reactive()
    // 2. A set event from the mutation in the emit handler (state.value = 999)
    // 3. The set event from state.value = 2
    expect(events.length).toBe(3);
    
    // First event is the initial replace
    expect(events[0].action).toBe('replace');
    
    // Second event is from the emit handler mutation
    expect(events[1].action).toBe('set');
    expect(events[1].path[0]).toBe('value');
    expect(events[1].newValue).toBe(999);
    
    // Third event is from our direct mutation
    expect(events[2].action).toBe('set');
    expect(events[2].path[0]).toBe('value');
    expect(events[2].newValue).toBe(2);
  });

  test("destructuring reactive objects breaks reactivity", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0, nested: { value: 50 } }, emit);
    
    // Destructure AFTER creating the reactive state
    // Initial destructuring doesn't track changes
    let { count, nested } = state; // Use let for count
    const { value } = nested; // nested is already a proxy, value is primitive
    
    // Updating the destructured properties shouldn't emit events
    count = count + 1;
    nested.value = 100;
    expect(events.length).toBe(2);
    expect(events[1].action).toBe('set');
    expect(events[1].path).toEqual(['nested', 'value']);
    expect(events[1].newValue).toBe(100);
    
    // Reset events
    events.length = 0;
    
    // Direct mutation of destructured primitive doesn't affect original
    // and won't trigger reactivity
    const newCount = count + 1;
    expect(newCount).toBe(2);
    expect(state.count).toBe(0);
    expect(events.length).toBe(0);
    
    // Updating through the original reactive object emits events
    state.count = 1;
    expect(events.length).toBe(1);
    expect(events[0].path).toEqual(['count']);
    expect(events[0].newValue).toBe(1);
  });

  test("toRefs maintains reactivity when destructuring", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0, nested: { value: 42 } }, emit);
    
    // Use toRefs to destructure while maintaining reactivity
    const { count, nested } = toRefs(state);
    
    // Reset events
    events.length = 0;
    
    // Update through the ref - should trigger events
    count.value++;
    expect(events.length).toBe(1);
    expect(events[0].path).toEqual(['count']);
    expect(events[0].newValue).toBe(1);
    expect(state.count).toBe(1);
    
    // Reset events
    events.length = 0;
    
    // Update nested ref - should trigger events
    nested.value.value = 100;
    expect(events.length).toBe(1);
    expect(events[0].path).toEqual(['nested', 'value']);
    expect(events[0].newValue).toBe(100);
    expect(state.nested.value).toBe(100);
  });
}); 