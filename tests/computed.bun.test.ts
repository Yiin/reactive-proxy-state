import { describe, it, expect, mock } from 'bun:test';
import { ref, isRef } from '../src/ref';
import { computed, isComputed } from '../src/computed';
import { watchEffect } from '../src/watchEffect';

// Simple mock function implementation (copied from ref.test.ts)
interface MockFn<T = any> {
  (arg: T): void;
  calls: T[];
  callCount: number;
  mockClear: () => void;
}

const createMockFn = <T = any>(): MockFn<T> => {
    const fn = (arg: T) => {
        fn.calls.push(arg);
        fn.callCount++;
    };
    fn.calls = [] as T[];
    fn.callCount = 0;
    fn.mockClear = () => {
        fn.calls = [];
        fn.callCount = 0;
    };
    return fn;
};

describe('computed', () => {
  it('should return computed value', () => {
    const value = ref(1);
    const cValue = computed(() => value.value + 1);
    expect(cValue.value).toBe(2);
  });

  it('should compute lazily', () => {
    const value = ref(1);
    const getterMock = createMockFn<number>();
    const cValue = computed(() => {
      getterMock(value.value);
      return value.value + 1;
    });

    // Getter should not be called until .value is accessed
    expect(getterMock.callCount).toBe(0);

    // Access .value
    expect(cValue.value).toBe(2);
    expect(getterMock.callCount).toBe(1);
    
    // Access again, should use cache
    expect(cValue.value).toBe(2);
    expect(getterMock.callCount).toBe(1); // Should not call getter again
  });

  it('should re-compute when dependency changes', () => {
    const value = ref(1);
    const getterMock = createMockFn<number>();
    const cValue = computed(() => {
      getterMock(value.value);
      return value.value + 1;
    });

    // Initial access (runs getter once via watchEffect, then reads value)
    expect(cValue.value).toBe(2);
    expect(getterMock.callCount).toBe(1);

    // Change dependency - this triggers the internal watchEffect's scheduler
    value.value = 2;

    // Getter should NOT have run yet (lazy)
    expect(getterMock.callCount).toBe(1);

    // Access the computed value again - this should trigger the re-computation
    expect(cValue.value).toBe(3); // value (2) + 1

    // Getter should have run again now
    expect(getterMock.callCount).toBe(2);
    
    // Access again, should be dirty and re-compute (but getter already ran)
    expect(cValue.value).toBe(3);
    // Re-accessing reads the cached value updated by the internal effect, doesn't run getter again here.
    expect(getterMock.callCount).toBe(2); 

    // Access again, should use cache
    expect(cValue.value).toBe(3);
    expect(getterMock.callCount).toBe(2);
  });

  it('should trigger watchEffect when computed value changes', () => {
    const value = ref(1);
    const cValue = computed(() => value.value + 1);
    const effectMock = createMockFn<number>();

    watchEffect(() => {
      effectMock(cValue.value); // Depend on computed value
    });

    expect(effectMock.callCount).toBe(1);
    expect(effectMock.calls[0]).toBe(2);

    // Change source ref
    value.value = 2;
    expect(effectMock.callCount).toBe(2); // Effect should re-run
    expect(effectMock.calls[1]).toBe(3); // New computed value

    // Change source ref again
     value.value = 3;
     expect(effectMock.callCount).toBe(3); 
     expect(effectMock.calls[2]).toBe(4);
  });

  it('should work with multiple dependencies', () => {
      const num1 = ref(1);
      const num2 = ref(10);
      const sum = computed(() => num1.value + num2.value);
      const effectMock = createMockFn<number>();

      watchEffect(() => effectMock(sum.value));

      expect(effectMock.callCount).toBe(1);
      expect(effectMock.calls[0]).toBe(11);

      num1.value = 2; // Change first dep
      expect(effectMock.callCount).toBe(2);
      expect(effectMock.calls[1]).toBe(12);

      num2.value = 20; // Change second dep
      expect(effectMock.callCount).toBe(3);
      expect(effectMock.calls[2]).toBe(22);

       // Change both deps (should only trigger once)
       // Note: with current sync execution, this triggers twice because
       // the computed updates synchronously after num1 change, triggering the effect,
       // then updates again after num2 change, triggering again.
       // Async/batched updates would consolidate this.
       num1.value = 3;
       expect(effectMock.callCount).toBe(4);
       expect(effectMock.calls[3]).toBe(23); // num1=3, num2=20
       num2.value = 30;
       expect(effectMock.callCount).toBe(5);
       expect(effectMock.calls[4]).toBe(33); // num1=3, num2=30
  });

  it('should handle chained computed properties', () => {
      const num = ref(1);
      const double = computed(() => num.value * 2);
      const quadruple = computed(() => double.value * 2);
      const effectMock = createMockFn<number>();

      watchEffect(() => effectMock(quadruple.value));

      expect(effectMock.callCount).toBe(1);
      expect(effectMock.calls[0]).toBe(4);

      num.value = 2; 
      expect(effectMock.callCount).toBe(2);
      expect(effectMock.calls[1]).toBe(8);

      num.value = 3;
      expect(effectMock.callCount).toBe(3);
      expect(effectMock.calls[2]).toBe(12);
  });
  
  it('should be readonly', () => {
      const num = ref(1);
      const double = computed(() => num.value * 2);
      
      // Simple mock for console.warn
      let warnArgs: any[] = [];
      let warnCount = 0;
      const mockWarn = (...args: any[]) => {
          warnArgs = args;
          warnCount++;
      };
      
      const originalWarn = console.warn;
      console.warn = mockWarn;
      
      expect(double.value).toBe(2);
      
      // Attempt to set should warn and not change value
      (double as any).value = 100; 
      
      expect(warnCount).toBe(1);
      expect(warnArgs[0]).toBe('computed value is read-only');
      expect(double.value).toBe(2); // Value should remain unchanged
      
      // Restore original console.warn
      console.warn = originalWarn;
  });

  it('isComputed should return true for computed refs and false otherwise', () => {
      const num = ref(1);
      const cVal = computed(() => num.value);
      
      expect(isComputed(cVal)).toBe(true);
      expect(isRef(cVal)).toBe(true); // Should also be a ref

      expect(isComputed(num)).toBe(false);
      expect(isComputed(1)).toBe(false);
      expect(isComputed({ value: 1 })).toBe(false);
      expect(isComputed(null)).toBe(false);
  });

}); 

describe('writable computed', () => {
  it('should allow creating a writable computed with get/set', () => {
    const source = ref(1);
    const plusOne = computed({
      get: () => source.value + 1,
      set: (val) => { source.value = val - 1; }
    });

    expect(isRef(plusOne)).toBe(true);
    expect(isComputed(plusOne)).toBe(true);
    expect(plusOne.value).toBe(2); // Initial get
  });

  it('should call the setter when value is assigned', () => {
    const source = ref(1);
    const setterMock = createMockFn<number>();
    const plusOne = computed({
      get: () => source.value + 1,
      set: (val) => {
        setterMock(val);
        source.value = val - 1; 
      }
    });

    expect(setterMock.callCount).toBe(0);
    plusOne.value = 5; // Set value
    expect(setterMock.callCount).toBe(1);
    expect(setterMock.calls[0]).toBe(5);
  });

  it('should update the source ref via the setter', () => {
    const source = ref(1);
    const plusOne = computed({
      get: () => source.value + 1,
      set: (val) => { source.value = val - 1; }
    });

    expect(source.value).toBe(1);
    expect(plusOne.value).toBe(2);

    plusOne.value = 10; // Set computed value

    expect(source.value).toBe(9); // Source should be updated (10 - 1)
    expect(plusOne.value).toBe(10); // Computed reflects the new value
  });

  it('should trigger watchEffect when writable computed value changes via set', () => {
    const source = ref(1);
    const plusOne = computed({
      get: () => source.value + 1,
      set: (val) => { source.value = val - 1; }
    });
    const effectMock = createMockFn<number>();

    watchEffect(() => {
      effectMock(plusOne.value); // Depend on computed value
    });

    expect(effectMock.callCount).toBe(1);
    expect(effectMock.calls[0]).toBe(2);

    // Set writable computed value
    plusOne.value = 5;
    expect(effectMock.callCount).toBe(2); // Effect should re-run
    expect(effectMock.calls[1]).toBe(5); // New computed value
    expect(source.value).toBe(4); // Verify source was updated

    // Change source ref directly should also trigger effect
     source.value = 10;
     expect(effectMock.callCount).toBe(3); 
     expect(effectMock.calls[2]).toBe(11);
  });
}); 