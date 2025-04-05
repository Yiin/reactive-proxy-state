import { describe, it, expect } from 'bun:test';
// Import directly from source files
import { ref, isRef, unref } from '../src/ref'; 
import { watchEffect } from '../src/watchEffect';

// Simple mock function implementation with better typing
interface MockFn<T = any> {
  (arg: T): void;
  calls: T[]; // Store arguments of the correct type
  callCount: number;
  mockClear: () => void;
}

// Simpler createMockFn using closure properties
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

describe('ref', () => {
  it('should create a ref object with .value property', () => {
    const r = ref(1);
    expect(isRef(r)).toBe(true);
    expect(r.value).toBe(1);
  });

  it('should work with different initial types', () => {
    const strRef = ref('hello');
    expect(strRef.value).toBe('hello');

    const objRef = ref({ a: 1 });
    expect(objRef.value).toEqual({ a: 1 });

    const nullRef = ref(null);
    expect(nullRef.value).toBe(null);

    const undefinedRef = ref();
    expect(undefinedRef.value).toBe(undefined);
  });

  it('isRef should return true for refs and false otherwise', () => {
    expect(isRef(ref(1))).toBe(true);
    expect(isRef(1)).toBe(false);
    expect(isRef({ value: 1 })).toBe(false);
    expect(isRef(null)).toBe(false);
    expect(isRef(undefined)).toBe(false);
  });

  it('unref should return inner value for refs and value itself otherwise', () => {
    expect(unref(ref(1))).toBe(1);
    expect(unref(1)).toBe(1);
    expect(unref(ref({ a: 1 }))).toEqual({ a: 1 });
    expect(unref({ a: 1 })).toEqual({ a: 1 });
  });

  it('should track dependency when .value is accessed', () => {
    const r = ref(1);
    const effectMock = createMockFn<number>(); // Explicit type

    watchEffect(() => {
      effectMock(r.value); // Access .value
    });

    expect(effectMock.callCount).toBe(1);
    expect(effectMock.calls[0]).toBe(1); // Check first arg of first call

    r.value = 2; // Trigger
    expect(effectMock.callCount).toBe(2);
    expect(effectMock.calls[1]).toBe(2); // Check first arg of second call
  });

  it('should trigger effect when .value is set', () => {
    const r = ref(1);
    let dummy: number; // No initializer
    const effectMock = createMockFn<number>(); // Explicit type
    const effectWrapper = () => {
      dummy = r.value;
      effectMock(dummy); // Pass value to mock
    }

    watchEffect(effectWrapper);
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(1); // Use non-null assertion if confident
    expect(effectMock.calls[0]).toBe(1);

    r.value = 2;
    expect(effectMock.callCount).toBe(2);
    expect(dummy!).toBe(2);
    expect(effectMock.calls[1]).toBe(2);
  });

  it('should not trigger effect if value is set to the same primitive value', () => {
    const r = ref(1);
    let dummy: number; // No initializer
    const effectMock = createMockFn<number>(); // Explicit type
    const effectWrapper = () => {
      dummy = r.value;
      effectMock(dummy); 
    }

    watchEffect(effectWrapper);
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(1);

    r.value = 1; // Set same value
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(1);
  });

  it('should trigger effect if value is set to a different object', () => {
    type ObjType = { a: number } | { b: number };
    const initialObj = { a: 1 };
    const newObj = { b: 2 };
    const r = ref<ObjType>(initialObj);
    let dummy: ObjType; // No initializer
    const effectMock = createMockFn<ObjType>(); // Explicit type
    const effectWrapper = () => {
      dummy = r.value;
      effectMock(dummy);
    }

    watchEffect(effectWrapper);
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(initialObj);
    expect(effectMock.calls[0]).toBe(initialObj);

    r.value = newObj;
    expect(effectMock.callCount).toBe(2);
    expect(dummy!).toBe(newObj);
    expect(effectMock.calls[1]).toBe(newObj);
  });

  it('should not trigger effect if value is set to the same object reference', () => {
    type ObjType = { a: number };
    const obj: ObjType = { a: 1 };
    const r = ref(obj);
    let dummy: ObjType; // No initializer
    const effectMock = createMockFn<ObjType>(); // Explicit type
    const effectWrapper = () => {
      dummy = r.value;
      effectMock(dummy);
    }

    watchEffect(effectWrapper);
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(obj);

    r.value = obj; // Set same reference
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(obj);
  });

  it('should not trigger effect if an object *inside* the ref is mutated (ref tracks identity)', () => {
    type ObjType = { a: number };
    const obj: ObjType = { a: 1 };
    const r = ref(obj);
    let dummy: ObjType; // No initializer
    const effectMock = createMockFn<ObjType>(); // Explicit type
    const effectWrapper = () => {
      dummy = r.value; // Track dependency on r.value (object identity)
      effectMock(dummy);
    }

    watchEffect(effectWrapper);
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(obj);

    // Mutate the object *referenced* by the ref
    r.value.a = 2; 
    // Effect should NOT re-run because the ref's value (the object reference) hasn't changed
    expect(effectMock.callCount).toBe(1);
    expect(dummy!).toBe(obj); // dummy still holds the same object reference
    expect(dummy!.a).toBe(2); // but the object itself has changed (use non-null assertion)

    // To track mutations *within* the object, the object itself needs to be reactive (e.g., wrapState)
    // or the effect needs to depend on the inner property:
    effectMock.mockClear(); // Clear previous calls
    let innerDummy: number; // No initializer
    const effectMockInner = createMockFn<number>(); // Explicit type
    const innerEffectWrapper = () => {
      innerDummy = r.value.a; // Track dependency on r.value.a
      effectMockInner(innerDummy);
    }
    watchEffect(innerEffectWrapper);
    expect(effectMockInner.callCount).toBe(1);
    expect(innerDummy!).toBe(2);
    
    // This still won't trigger, because the object returned by r.value is NOT reactive
    r.value.a = 3; 
    expect(effectMockInner.callCount).toBe(1);
    expect(innerDummy!).toBe(2); 
  });
}); 