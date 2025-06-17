import { expect, test, describe, mock } from "bun:test";
import { reactive, watchEffect } from '../src/index';
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

  test('watchEffect handles self-mutation and triggers other effects', () => {
    const state = reactive({ count: 0 }, () => {});

    let runCountA = 0;
    const effectA = mock(() => {
      if (runCountA++ >= 10) throw new Error("Effect A ran too many times!");
      // Effect A reads and increments its own dependency
      state.count++;
    });

    let runCountB = 0;
    const effectB = mock(() => {
      if (runCountB++ >= 10) throw new Error("Effect B ran too many times!");
      // Effect B only reads the dependency
      state.count;
    });

    const stopA = watchEffect(effectA);
    const stopB = watchEffect(effectB);

    // --- Initial Run --- 
    // Effect A runs once, reads 0, increments count to 1.
    // This change triggers Effect B.
    // Effect B runs once (due to A's change), reads 1.
    expect(effectA).toHaveBeenCalledTimes(1); 
    expect(effectB).toHaveBeenCalledTimes(1); // Initially runs, sees 0
    expect(state.count).toBe(1); // Changed by A

    // --- Post-Initial Run Trigger --- 
    // At this point, A finished run 1 (count=1), B triggered by A's change and ran run 1 (sees 1).
    // Need to check if B runs again because of A's initial mutation.
    // The framework likely batches the triggers. A runs, sets count=1, triggers B.
    // B runs, sees count=1. 
    // Let's refine the above expectation: A runs (1), sets count=1. B runs (1), reads 1. 
    // Check this state precisely.
    expect(effectA).toHaveBeenCalledTimes(1); 
    expect(effectB).toHaveBeenCalledTimes(1); // Re-asserting after potential microtask timing
    expect(state.count).toBe(1);

    // --- External Change --- 
    // Now, change count externally.
    state.count = 5;
    // This should trigger both A and B.
    // Assume A runs first: reads 5, increments count to 6. (A run 2)
    // Then B runs: reads 6. (B run 2)
    // However, because A modifies the count, it also triggers B again (B run 3)
    // In a perfect implementation, this would be batched, but our current implementation
    // runs B a third time. This is acceptable behavior, although not optimal.
    expect(effectA).toHaveBeenCalledTimes(2); 
    expect(effectB).toHaveBeenCalledTimes(3); // B runs for the external change and the internal change from A
    expect(state.count).toBe(6); // Changed by A during its second run

    stopA();
    stopB();

    // --- After Stop --- 
    state.count = 10;
    expect(effectA).toHaveBeenCalledTimes(2);
    expect(effectB).toHaveBeenCalledTimes(3);
    expect(state.count).toBe(10);
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

    const getterMock = mock(() => {}); // Mock to track getter calls

    Object.defineProperty(stateObj, 'count', {
        get() {
            getterMock(); // Track getter access
            return this._count; 
        },
        enumerable: true,
        configurable: true
    });
    const state = reactive<{ _count: number, count: number }>(stateObj as any, () => {});

    // Simplify the effect - just access the getter
    const stop = watchEffect(() => {
        state.count; // Just access the getter
    });

    expect(getterMock).toHaveBeenCalledTimes(1); // Getter called once initially

    // Mutate the underlying property the getter depends on
    state._count = 5;
    // Getter should be called again when effect re-runs due to dependency change
    expect(getterMock).toHaveBeenCalledTimes(2); 
    
    // Accessing getter outside effect should not trigger effect run, but should call getter
    const currentVal = state.count;
    expect(currentVal).toBe(5);
    expect(getterMock).toHaveBeenCalledTimes(3); 

    stop(); // Clean up
  });

  test('watchEffect supports onCleanup - basic cleanup on re-run', () => {
    const state = reactive({ count: 0 }, () => {});
    const cleanupFn = mock(() => {});
    
    const effectFn = mock((onCleanup: (fn: () => void) => void) => {
      onCleanup(cleanupFn);
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(0); // No cleanup on first run
    
    // Trigger re-run - should call cleanup before re-running
    state.count = 1;
    
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1); // Cleanup called before re-run
    
    stop();
  });

  test('watchEffect supports onCleanup - cleanup on stop', () => {
    const state = reactive({ count: 0 }, () => {});
    const cleanupFn = mock(() => {});
    
    const effectFn = mock((onCleanup: (fn: () => void) => void) => {
      onCleanup(cleanupFn);
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(0);
    
    // Stop the effect - should call cleanup
    stop();
    
    expect(cleanupFn).toHaveBeenCalledTimes(1); // Cleanup called on stop
  });

  test('watchEffect supports onCleanup - multiple cleanup functions', () => {
    const state = reactive({ count: 0 }, () => {});
    const cleanup1 = mock(() => {});
    const cleanup2 = mock(() => {});
    
    const effectFn = mock((onCleanup: (fn: () => void) => void) => {
      onCleanup(cleanup1);
      onCleanup(cleanup2);
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(cleanup1).toHaveBeenCalledTimes(0);
    expect(cleanup2).toHaveBeenCalledTimes(0);
    
    // Trigger re-run
    state.count = 1;
    
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(cleanup1).toHaveBeenCalledTimes(1); // Both cleanup functions called
    expect(cleanup2).toHaveBeenCalledTimes(1);
    
    stop();
    
    // On stop, the new cleanup functions should be called
    expect(cleanup1).toHaveBeenCalledTimes(2);
    expect(cleanup2).toHaveBeenCalledTimes(2);
  });

  test('watchEffect supports onCleanup - cleanup exceptions do not break effect', () => {
    const state = reactive({ count: 0 }, () => {});
    const workingCleanup = mock(() => {});
    const brokenCleanup = mock(() => {
      throw new Error("Cleanup error");
    });
    
    const effectFn = mock((onCleanup: (fn: () => void) => void) => {
      onCleanup(brokenCleanup);
      onCleanup(workingCleanup);
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Trigger re-run - should handle cleanup errors gracefully
    state.count = 1;
    
    expect(effectFn).toHaveBeenCalledTimes(2); // Effect still runs despite cleanup error
    expect(brokenCleanup).toHaveBeenCalledTimes(1);
    expect(workingCleanup).toHaveBeenCalledTimes(1);
    
    stop();
  });

  test('watchEffect supports onCleanup - cleanup with async operations', () => {
    const state = reactive({ count: 0 }, () => {});
    const cleanupFn = mock(() => {});
    let intervalId: NodeJS.Timeout;
    
    const effectFn = mock((onCleanup: (fn: () => void) => void) => {
      // Simulate setting up an async operation
      intervalId = setInterval(() => {}, 100);
      
      onCleanup(() => {
        cleanupFn();
        clearInterval(intervalId);
      });
      
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(0);
    
    // Trigger re-run
    state.count = 1;
    
    expect(effectFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1); // Cleanup called, interval cleared
    
    stop();
    
    expect(cleanupFn).toHaveBeenCalledTimes(2); // Final cleanup on stop
  });

  test('watchEffect onCleanup - no cleanup function provided should work normally', () => {
    const state = reactive({ count: 0 }, () => {});
    
    // Effect that doesn't use onCleanup parameter
    const effectFn = mock(() => {
      return state.count;
    });
    
    const stop = watchEffect(effectFn);
    
    expect(effectFn).toHaveBeenCalledTimes(1);
    
    // Should work normally without cleanup
    state.count = 1;
    expect(effectFn).toHaveBeenCalledTimes(2);
    
    stop();
  });
}); 