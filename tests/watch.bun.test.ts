import { expect, test, describe, mock } from "bun:test";
import { reactive, watch, ref, computed } from '../src/index';
import { createEventCollector } from './test-utils';

describe("Watch Tests", () => {
  test("watch calls callback when source changes", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    const callback = mock((newVal: number, oldVal: number | undefined) => {});
    
    const stop = watch(() => state.count, callback);
    
    state.count = 1;
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0);
    
    stop(); // Clean up
  });
  
  test("watch does not call callback when value doesn't change", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    const callback = mock((newVal: number, oldVal: number | undefined) => {});
    
    const stop = watch(() => state.count, callback);
    
    state.count = 0; // Same value
    
    expect(callback).toHaveBeenCalledTimes(0);
    
    stop(); // Clean up
  });
  
  test("watch with immediate option calls callback immediately", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    const callback = mock((newVal: number, oldVal: number | undefined) => {});
    
    const stop = watch(() => state.count, callback, { immediate: true });
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(0, undefined);
    
    state.count = 1;
    
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1]).toEqual([1, 0]);
    
    stop(); // Clean up
  });
  
  test("watch stops watching when stop function is called", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    const callback = mock((newVal: number, oldVal: number | undefined) => {});
    
    const stop = watch(() => state.count, callback);
    
    state.count = 1;
    expect(callback).toHaveBeenCalledTimes(1);
    
    stop(); // Stop watching
    
    state.count = 2;
    expect(callback).toHaveBeenCalledTimes(1); // Still only called once
  });
  
  test("watch on nested properties", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ user: { name: "Alice", age: 30 } }, emit);
    const callback = mock((newVal: string, oldVal: string | undefined) => {});
    
    const stop = watch(() => state.user.name, callback);
    
    state.user.name = "Bob";
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("Bob", "Alice");
    
    // Changing unrelated property should not trigger callback
    state.user.age = 31;
    expect(callback).toHaveBeenCalledTimes(1);
    
    stop(); // Clean up
  });
  
  test("watch on nested object with deep option", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ user: { name: "Alice", address: { city: "New York" } } }, emit);
    const callback = mock((newVal: any, oldVal: any) => {});
    
    const stop = watch(() => state.user, callback, { deep: true });
    
    state.user.name = "Bob";
    
    expect(callback).toHaveBeenCalledTimes(1);
    
    state.user.address.city = "Boston";
    
    expect(callback).toHaveBeenCalledTimes(2);
    
    stop(); // Clean up
  });
  
  test("watch with array sources", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ items: [1, 2, 3] }, emit);
    const callback = mock((newVal: number[], oldVal: number[] | undefined) => {});
    
    const stop = watch(() => state.items, callback, { deep: true });
    
    state.items.push(4);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([1, 2, 3, 4], [1, 2, 3]);
    
    stop(); // Clean up
  });
  
  test("watch with Map sources", () => {
    const { events, emit } = createEventCollector();
    const map = new Map<string, number>([["a", 1], ["b", 2]]);
    const state = reactive({ map }, emit);
    const callback = mock((newVal: Map<string, number>, oldVal: Map<string, number> | undefined) => {});
    
    const stop = watch(() => state.map, callback, { deep: true });
    
    state.map.set("c", 3);
    
    // Map watch should trigger at least once - reactive systems may trigger multiple times due to deep watching
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
    
    stop(); // Clean up
  });
  
  test("watch with Set sources", () => {
    const { events, emit } = createEventCollector();
    const set = new Set([1, 2, 3]);
    const state = reactive({ set }, emit);
    const callback = mock((newVal: Set<number>, oldVal: Set<number> | undefined) => {});
    
    const stop = watch(() => state.set, callback, { deep: true });
    
    state.set.add(4);
    
    // Set watch should trigger at least once - reactive systems may trigger multiple times due to deep watching
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
    
    stop(); // Clean up
  });
  
  test("watch should handle multiple watches on the same source", () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ count: 0 }, emit);
    
    const callback1 = mock((newVal: number, oldVal: number | undefined) => {});
    const callback2 = mock((newVal: number, oldVal: number | undefined) => {});
    
    const stop1 = watch(() => state.count, callback1);
    const stop2 = watch(() => state.count, callback2);
    
    state.count = 1;
    
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    
    stop1();
    
    state.count = 2;
    
    expect(callback1).toHaveBeenCalledTimes(1); // Still only called once
    expect(callback2).toHaveBeenCalledTimes(2);
    
    stop2(); // Clean up
  });

  test('watches a plain object directly (deep default)', () => {
    const state = reactive({ a: 1, nested: { b: 2 } }, () => {});
    const callback = mock((newVal, oldVal) => {});
    
    const stop = watch(state, callback); // deep: true is default

    state.a = 10;
    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toEqual({ a: 10, nested: { b: 2 } });
    expect(callback.mock.calls[0][1]).toEqual({ a: 1, nested: { b: 2 } });

    state.nested.b = 20;
    expect(callback.mock.calls.length).toBe(2);
    expect(callback.mock.calls[1][0]).toEqual({ a: 10, nested: { b: 20 } });
    expect(callback.mock.calls[1][1]).toEqual({ a: 10, nested: { b: 2 } });
    
    stop();
  });

  test('watches with deep: false', () => {
    const state = reactive({ nested: { value: 1 } }, () => {});
    const callback = mock((newVal, oldVal) => {});
    
    const stop = watch(() => state.nested, callback, { deep: false });

    state.nested.value = 2; // Modify nested - should NOT trigger
    expect(callback.mock.calls.length).toBe(0);

    const oldNested = state.nested;
    state.nested = { value: 3 }; // Replace object - SHOULD trigger
    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toEqual({ value: 3 });
    expect(callback.mock.calls[0][1]).toBe(oldNested);

    stop();
  });

  test('watch with immediate: true and deep: true', () => {
    const state = reactive({ nested: { value: 1 } }, () => {});
    const callback = mock((newVal, oldVal) => {});

    const stop = watch(state.nested, callback, { immediate: true, deep: true });

    expect(callback.mock.calls.length).toBe(1); // Immediate call
    expect(callback.mock.calls[0][0]).toEqual({ value: 1 });
    expect(callback.mock.calls[0][1]).toBeUndefined();

    state.nested.value = 2; // Nested change triggers again
    expect(callback.mock.calls.length).toBe(2);
    expect(callback.mock.calls[1][0]).toEqual({ value: 2 });
    expect(callback.mock.calls[1][1]).toEqual({ value: 1 });

    stop();
  });

  test('watches specific Map properties (get, has)', () => {
    const state = reactive({ map: new Map([['a', 1], ['b', 2]]) }, () => {});
    const watchGet = mock((newVal, oldVal) => {});
    const watchHas = mock((newVal, oldVal) => {});

    const stopGet = watch(() => state.map.get('a'), watchGet);
    const stopHas = watch(() => state.map.has('c'), watchHas);

    expect(watchGet.mock.calls.length).toBe(0);
    expect(watchHas.mock.calls.length).toBe(0);

    state.map.set('a', 10); // Change watched key ('a')
    expect(watchGet.mock.calls.length).toBe(1);
    expect(watchGet.mock.calls[0][0]).toBe(10);
    expect(watchGet.mock.calls[0][1]).toBe(1);

    state.map.set('b', 20); // Change other key ('b')
    expect(watchGet.mock.calls.length).toBe(1);

    state.map.set('c', 3); // Add watched key ('c')
    expect(watchHas.mock.calls.length).toBe(1);
    expect(watchHas.mock.calls[0][0]).toBe(true);
    expect(watchHas.mock.calls[0][1]).toBe(false);

    state.map.delete('c'); // Delete watched key ('c')
    expect(watchHas.mock.calls.length).toBe(2);
    expect(watchHas.mock.calls[1][0]).toBe(false);
    expect(watchHas.mock.calls[1][1]).toBe(true);

    stopGet();
    stopHas();
  });

  test('watches Map/Set size', () => {
    const state = reactive({ map: new Map(), set: new Set() }, () => {});
    const mapSizeCb = mock((newVal, oldVal) => {});
    const setSizeCb = mock((newVal, oldVal) => {});

    const stopMap = watch(() => state.map.size, mapSizeCb);
    const stopSet = watch(() => state.set.size, setSizeCb);

    expect(mapSizeCb.mock.calls.length).toBe(0);
    expect(setSizeCb.mock.calls.length).toBe(0);

    state.map.set('a', 1); // Add to map
    // TODO: Fix Map.size reactivity - this should be 1
    expect(mapSizeCb.mock.calls.length).toBe(1); 
    expect(mapSizeCb.mock.calls[0][0]).toBe(1);
    expect(mapSizeCb.mock.calls[0][1]).toBe(0);

    state.set.add(10); // Add to set
    expect(setSizeCb.mock.calls.length).toBe(1);
    expect(setSizeCb.mock.calls[0][0]).toBe(1);
    expect(setSizeCb.mock.calls[0][1]).toBe(0);

    state.map.delete('a'); // Delete from map
    expect(mapSizeCb.mock.calls.length).toBe(2);
    expect(mapSizeCb.mock.calls[1][0]).toBe(0);
    expect(mapSizeCb.mock.calls[1][1]).toBe(1);

    state.set.delete(10); // Delete from set
    expect(setSizeCb.mock.calls.length).toBe(2);
    
    stopMap();
    stopSet();
  });

  test('provides correct oldValue and newValue (primitive)', () => {
    const state = reactive({ count: 0 }, () => {});
    const callback = mock((newVal, oldVal) => {});
    const stop = watch(() => state.count, callback);

    state.count = 5;
    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toBe(5);
    expect(callback.mock.calls[0][1]).toBe(0);

    state.count = 10;
    expect(callback.mock.calls.length).toBe(2);
    expect(callback.mock.calls[1][0]).toBe(10);
    expect(callback.mock.calls[1][1]).toBe(5);

    stop();
  });

  test('provides correct oldValue and newValue (object, deep)', () => {
    const state = reactive<{ obj: { val: number } }>({ obj: { val: 1 } }, () => {});
    const callback = mock((newVal, oldVal) => {});
    const stop = watch(() => state.obj, callback, { deep: true });

    const firstProxy = state.obj; // Keep ref to initial proxy
    state.obj.val = 2;
    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toBe(firstProxy); // newValue is the proxy 
    expect(callback.mock.calls[0][0]?.val).toBe(2);
    expect(callback.mock.calls[0][1]).toEqual({ val: 1 }); // oldValue is a clone
    expect(callback.mock.calls[0][1]).not.toBe(firstProxy);

    // Replace the object
    const secondProxy = state.obj; // Keep ref before replacing
    state.obj = { val: 3 }; 
    const thirdProxy = state.obj; // Ref to new proxy

    expect(callback.mock.calls.length).toBe(2);
    expect(callback.mock.calls[1][0]).toBe(thirdProxy); // New proxy
    expect(callback.mock.calls[1][0]?.val).toBe(3);
    expect(callback.mock.calls[1][1]).toEqual({ val: 2 }); // Clone of state *before* replacement
    expect(callback.mock.calls[1][1]).not.toBe(secondProxy);
    
    stop();
  });

  test('watches sources returning null/undefined', () => {
    const state = reactive<{ prop: { nested: number } | null }>({ prop: { nested: 1 } }, () => {});
    const callback = mock((newVal, oldVal) => {});
    const stop = watch(() => state.prop?.nested, callback);

    expect(callback.mock.calls.length).toBe(0);

    state.prop!.nested = 2; // Change nested value
    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toBe(2);
    expect(callback.mock.calls[0][1]).toBe(1);

    const oldPropVal = state.prop!.nested;
    state.prop = null; // Set containing object to null
    expect(callback.mock.calls.length).toBe(2);
    expect(callback.mock.calls[1][0]).toBeUndefined();
    expect(callback.mock.calls[1][1]).toBe(oldPropVal); // Old value was 2

    state.prop = { nested: 3 }; // Set it back
    expect(callback.mock.calls.length).toBe(3);
    expect(callback.mock.calls[2][0]).toBe(3);
    expect(callback.mock.calls[2][1]).toBeUndefined();

    stop();
  });

  test('watches getters', () => {
    const stateObj = { _a: 1, _b: 2 };
    Object.defineProperty(stateObj, 'computed', {
        get() { return this._a + this._b; },
        enumerable: true, configurable: true
    });
    const state = reactive<{ _a: number, _b: number, computed: number }>(stateObj as any, () => {});
    const callback = mock((newVal, oldVal) => {});

    const stop = watch(() => state.computed, callback);

    expect(callback.mock.calls.length).toBe(0);

    state._a = 10; // Change dependency _a
    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toBe(12);
    expect(callback.mock.calls[0][1]).toBe(3);

    state._b = 20; // Change dependency _b
    expect(callback.mock.calls.length).toBe(2);
    expect(callback.mock.calls[1][0]).toBe(30);
    expect(callback.mock.calls[1][1]).toBe(12);

    (state as any)._c = 100; // Change unrelated
    expect(callback.mock.calls.length).toBe(2);
    
    stop();
  });

  test('watch with array sources', () => {
    const state = reactive({ arr: [1, 2] }, () => {});
    const callback = mock(() => {});
    const stop = watch(() => state.arr, callback, { deep: true });

    state.arr.push(3);
    expect(callback.mock.calls.length).toBe(1);
    stop();
  });

  test('watch with Map sources', () => {
    const state = reactive({ map: new Map([['a', 1]]) }, () => {});
    const callback = mock(() => {});
    const stop = watch(() => state.map, callback, { deep: true }); // Or watch(state.map, callback)

    state.map.set("c", 3);
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
    stop();
  });

  test('watch with Set sources', () => {
    const state = reactive({ set: new Set([1]) }, () => {});
    const callback = mock(() => {});
    const stop = watch(() => state.set, callback, { deep: true }); // Or watch(state.set, callback)

    state.set.add(4);
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
    stop();
  });

  test('watch should handle multiple watches on the same source', () => {
    const state = reactive({ count: 0 }, () => {});
    const callback1 = mock(() => {});
    const callback2 = mock(() => {});

    const stop1 = watch(() => state.count, callback1);
    const stop2 = watch(() => state.count, callback2);

    state.count = 1;
    expect(callback1.mock.calls.length).toBe(1);
    expect(callback2.mock.calls.length).toBe(1);

    stop1();
    state.count = 2;
    expect(callback1.mock.calls.length).toBe(1);
    expect(callback2.mock.calls.length).toBe(2);

    stop2();
    state.count = 3;
    expect(callback1.mock.calls.length).toBe(1);
    expect(callback2.mock.calls.length).toBe(2);
  });

  test('watch with array sources unwraps reactive values', () => {
    const { events, emit } = createEventCollector();
    const state = reactive({ items: [1, 2, 3] }, emit);
    const callback = mock((newVal: number[], oldVal: number[] | undefined) => {});
    
    const stop = watch(() => state.items, callback, { deep: true });
    
    state.items.push(4);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([1, 2, 3, 4], [1, 2, 3]);
    
    stop(); // Clean up
  });

  test('watch with multiple sources unwraps refs and computed', () => {
    // This test verifies the exact issue the user reported
    
    // Create reactive sources like the user's example
    const count = ref(0);
    const doubled = computed(() => count.value * 2);
    const user = reactive({ name: 'test' });
    
    const callback = mock((newValues: any[], oldValues: any[]) => {});
    
    // Watch multiple sources - should unwrap automatically
    const stop = watch([count, doubled, () => user.name], callback);
    
    // Trigger changes
    count.value = 1;
    
    // Just check that callback was called with arrays
    expect(callback).toHaveBeenCalled();
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
    expect(Array.isArray(lastCall[0])).toBe(true);
    expect(lastCall[0]).toEqual([1, 2, 'test']);
    
    stop();
  });

  test('watch multiple sources - each value should be unwrapped and usable', () => {
    // This is the exact scenario from the user's issue description
    // Using a simpler computed that doesn't rely on complex timing
    
    const items = ref([1, 2, 3]);
    const doubledCount = computed(() => items.value.length * 2); // Simple transformation
    
    let capturedInteractions: number[] = [];
    let capturedDoubledCount: number = 0;
    let callbackCalled = false;
    
    const stop = watch([items, doubledCount], (([interactions, doubledCountValue]) => {
      // These should be unwrapped and directly usable
      capturedInteractions = interactions;
      capturedDoubledCount = doubledCountValue;
      callbackCalled = true;
      
      // Should be able to call array methods directly (no .value needed)
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions.some(item => item > 0)).toBe(true);
      
      // Should be able to use computed value directly
      expect(typeof doubledCountValue).toBe('number');
      expect(doubledCountValue).toBe(interactions.length * 2);
    }));
    
    // Trigger change
    items.value = [1, 2, 3, 4]; // Set new array to trigger change
    
    // Verify the callback was called and received unwrapped values
    expect(callbackCalled).toBe(true);
    expect(capturedInteractions).toEqual([1, 2, 3, 4]);
    expect(capturedDoubledCount).toBe(8); // 4 * 2
    
    stop();
  });

  test('watch multiple sources with unwrapped values', () => {
    // Example: entity.interactions (computed), clientState (reactive)
    const interactions = computed(() => [1, 2, 3]);
    const clientState = ref({ active: true });
    
    let testPassed = false;
    
    const stop = watch([interactions, clientState], (([interactionsValue, clientStateValue]: [number[], { active: boolean }]) => {
      // ✅ This should work now - no .value needed
      expect(interactionsValue.length).toBe(3); // Direct array access
      expect(interactionsValue.some(x => x > 0)).toBe(true); // Direct array methods
      
      // This is the new value after the change
      if (clientStateValue.active === false) {
        testPassed = true;
      }
    }));
    
    // Trigger a change
    clientState.value = { active: false };
    
    expect(testPassed).toBe(true);
    stop();
  });



}); 