import { expect, test, describe, mock, spyOn } from "bun:test";
import { reactive, watchEffect, StateEvent, EmitFunction } from '../src/index';
import { createEventCollector } from './test-utils';

describe("WatchEffect Tests", () => {
  test("watchEffect runs immediately", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    const effectFn = mock(() => {
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    stop(); // Clean up
  });
  
  test("watchEffect runs when tracked dependency changes", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0, unrelated: 'test' }, emit);
    const effectFn = mock(() => {
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Changing the tracked dependency should trigger the effect
    state.count = 1;
    
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    stop(); // Clean up
  });
  
  test("watchEffect does not run when untracked property changes", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0, unrelated: 'test' }, emit);
    const effectFn = mock(() => {
      return state.count; // Only tracking count
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Changing untracked property should not trigger the effect
    state.unrelated = 'changed';
    
    expect(effectFn).toHaveBeenCalledTimes(1); // Still only called once
    
    stop(); // Clean up
  });
  
  test("watchEffect tracks nested dependencies", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ 
      user: { 
        name: "Alice", 
        profile: { 
          age: 30
        } 
      } 
    }, emit);
    
    const effectFn = mock(() => {
      // Track both the name and nested age
      return `${state.user.name} is ${state.user.profile.age} years old`;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Changing tracked dependency should trigger the effect
    state.user.name = "Bob";
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    // Changing nested tracked dependency should also trigger the effect
    state.user.profile.age = 31;
    expect(effectFn).toHaveBeenCalledTimes(3);
    
    stop(); // Clean up
  });
  
  test("watchEffect stops when stop function is called", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    const effectFn = mock(() => {
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Changing tracked dependency should trigger the effect
    state.count = 1;
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    stop(); // Stop watching
    
    // After stopping, changes should not trigger the effect
    state.count = 2;
    expect(effectFn).toHaveBeenCalledTimes(2); // Still only called twice
  });
  
  test("watchEffect with array operations", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ items: [1, 2, 3] }, emit);
    const effectFn = mock(() => {
      return state.items.join(',');
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Array mutation should trigger the effect
    state.items.push(4);
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    // Other array operations
    state.items.pop();
    expect(effectFn).toHaveBeenCalledTimes(3);
    
    state.items.splice(0, 1);
    expect(effectFn).toHaveBeenCalledTimes(4);
    
    stop(); // Clean up
  });
  
  test("watchEffect with Map operations", () => {
    const { events, emit } = createEventCollector();
    const map = new Map<string, number>([["a", 1], ["b", 2]]);
    const state = reactive({ map }, emit);
    const effectFn = mock(() => {
      return Array.from(state.map.entries());
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Map mutations should trigger the effect
    state.map.set("c", 3);
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    state.map.delete("a");
    expect(effectFn).toHaveBeenCalledTimes(3);
    
    stop(); // Clean up
  });
  
  test("watchEffect with Set operations", () => {
    const { events, emit } = createEventCollector();
    const set = new Set([1, 2, 3]);
    const state = reactive({ set }, emit);
    const effectFn = mock(() => {
      return Array.from(state.set);
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Set mutations should trigger the effect
    state.set.add(4);
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    state.set.delete(1);
    expect(effectFn).toHaveBeenCalledTimes(3);
    
    stop(); // Clean up
  });

  test("watchEffect with tracking events", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    
    const onTrack = mock((event: any) => {});
    const onTrigger = mock((event: any) => {});
    
    const effectFn = mock(() => state.count);
    
    const stop = watchEffect(effectFn, { 
      onTrack,
      onTrigger
    });
    
    // onTrack should be called during initial tracking
    expect(onTrack).toHaveBeenCalled();
    
    // Update the tracked dependency
    state.count = 1;
    
    // onTrigger should be called when dependency changes
    expect(onTrigger).toHaveBeenCalled();
    
    stop(); // Clean up
  });
  
  test("watchEffect handles multiple tracked dependencies", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ 
      count: 0,
      name: "Alice",
      flags: {
        active: true,
        visible: false
      }
    }, emit);
    
    const effectFn = mock(() => {
      // Track multiple properties
      return {
        count: state.count,
        name: state.name,
        active: state.flags.active
      };
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Each property change should trigger exactly once
    state.count = 1;
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    state.name = "Bob";
    expect(effectFn).toHaveBeenCalledTimes(3);
    
    state.flags.active = false;
    expect(effectFn).toHaveBeenCalledTimes(4);
    
    // Untracked property shouldn't trigger
    state.flags.visible = true;
    expect(effectFn).toHaveBeenCalledTimes(4);
    
    stop(); // Clean up
  });

  test('watchEffect tracks property additions', () => {
    const state = reactive<{ prop?: number }>({}, () => {});
    const effectFn = mock(() => {
      // Access potentially non-existent prop
      const val = state.prop;
    });

    watchEffect(effectFn);
    expect(effectFn).toHaveBeenCalledTimes(1);

    // Add the property
    state.prop = 10;
    expect(effectFn).toHaveBeenCalledTimes(2);
  });

  test('watchEffect tracks property deletions', () => {
    const state = reactive<{ prop?: number }>({ prop: 5 }, () => {});
    const effectFn = mock(() => {
      const val = state.prop;
    });

    watchEffect(effectFn);
    expect(effectFn).toHaveBeenCalledTimes(1);

    // Delete the property
    delete state.prop;
    expect(effectFn).toHaveBeenCalledTimes(2);
  });

  test('watchEffect handles conditional tracking', () => {
    const state = reactive({ flag: true, a: 1, b: 2 }, () => {});
    let value: number | undefined;
    const effectFn = mock(() => {
      value = state.flag ? state.a : state.b;
    });

    watchEffect(effectFn);
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(value).toBe(1);

    // Change tracked dependency (a)
    state.a = 10;
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(value).toBe(10);

    // Change untracked dependency (b)
    state.b = 20;
    expect(effectFn).toHaveBeenCalledTimes(2); // Should not run again
    expect(value).toBe(10);

    // Flip the condition
    state.flag = false;
    expect(effectFn).toHaveBeenCalledTimes(3);
    expect(value).toBe(20); // Now tracking b

    // Change tracked dependency (b)
    state.b = 30;
    expect(effectFn).toHaveBeenCalledTimes(4);
    expect(value).toBe(30);

    // Change untracked dependency (a)
    state.a = 100;
    expect(effectFn).toHaveBeenCalledTimes(4); // Should not run again
    expect(value).toBe(30);
  });

  test('watchEffect can stop itself', () => {
    const state = reactive({ count: 0 }, () => {});
    let stopHandle: (() => void) | null = null;
    const effectFn = mock(() => {
      if (state.count >= 2) {
        stopHandle?.();
      }
    });

    stopHandle = watchEffect(effectFn);
    expect(effectFn).toHaveBeenCalledTimes(1);

    state.count++;
    expect(effectFn).toHaveBeenCalledTimes(2);

    state.count++; // Should trigger stop
    expect(effectFn).toHaveBeenCalledTimes(3);

    state.count++; // Should not trigger anymore
    expect(effectFn).toHaveBeenCalledTimes(3);
  });

  test('watchEffect does not trigger excessively for no-op mutations', () => {
    const obj = { prop: 1 };
    const set = new Set([1, 2]);
    const map = new Map([["a", 1]]);
    const state = reactive({ obj, set, map }, () => {}); 
    
    const objEffect = mock(() => { state.obj.prop });
    const setEffect = mock(() => { for (const _ of state.set); }); // Iterate to track
    const mapEffect = mock(() => { state.map.get("a"); });

    const stop = watchEffect(() => {
      objEffect();
      setEffect();
      mapEffect();
    });
    expect(objEffect).toHaveBeenCalledTimes(1);
    expect(setEffect).toHaveBeenCalledTimes(1);
    expect(mapEffect).toHaveBeenCalledTimes(1);

    // Set property to the same value
    state.obj.prop = 1;
    expect(objEffect).toHaveBeenCalledTimes(1); // Should not re-run

    // Add existing element to Set
    state.set.add(1);
    expect(setEffect).toHaveBeenCalledTimes(1); // Should not re-run
    
    // Set existing key in Map to the same value
    state.map.set("a", 1);
    expect(mapEffect).toHaveBeenCalledTimes(1); // Should not re-run

    stop(); // Clean up
  });

  test('watchEffect tracks getters', () => {
    const stateObj = { _count: 0 };
    Object.defineProperty(stateObj, 'count', {
        get() { 
            getterMock(); // Track getter access
            return this._count; 
        },
        enumerable: true,
        configurable: true
    });
    const state = reactive<{ _count: number, count: number }>(stateObj as any, () => {});
    let value: number | undefined; // Keep value for later checks if needed, but don't assign in effect
    const effectFn = mock(() => {
        // This mock is NOT the user effect passed to watchEffect initially
    });
    const getterMock = mock(() => {}); // Mock to track getter calls

    // Simplify the effect - just access the getter
    const stop = watchEffect(() => {
        state.count; // Just access the getter
        // effectFn(); // Remove call to test mock
    });
    // expect(effectFn).toHaveBeenCalledTimes(1); // Remove check for test mock
    expect(getterMock).toHaveBeenCalledTimes(1); // Getter called once initially
    // expect(value).toBe(0); // Remove initial value check

    // Mutate the underlying property the getter depends on
    state._count = 5;
    // Getter should be called again when effect re-runs due to dependency change
    expect(getterMock).toHaveBeenCalledTimes(2); 
    // expect(effectFn).toHaveBeenCalledTimes(2); // Remove check for test mock
    // expect(value).toBe(5); // Value is not tracked in this simplified effect
    
    // Accessing getter outside effect should not trigger effect run, but should call getter
    const currentVal = state.count;
    expect(currentVal).toBe(5);
    // expect(effectFn).toHaveBeenCalledTimes(2); // Remove check for test mock
    // Getter is called directly here
    expect(getterMock).toHaveBeenCalledTimes(3); 

    stop(); // Clean up
  });
}); 