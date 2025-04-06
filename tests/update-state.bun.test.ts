import { expect, test, describe } from "bun:test";
import { updateState, StateEvent } from '../src/index';

describe("Update State Tests", () => {
  test("updateState applies set", () => {
    const obj = { value: 42 };
    const event: StateEvent = {
      action: 'set',
      path: ['value'],
      newValue: 43
    };

    updateState(obj, event);

    expect(obj.value).toBe(43);
  });

  test("updateState applies map-set", () => {
    const obj = { map: new Map([['a', 1]]) };
    const event: StateEvent = {
      action: 'set',
      path: ['map', 'b'],
      newValue: 2
    };

    updateState(obj, event);

    expect(obj.map.get('b')).toBe(2);
  });

  test("updateState handles all action types", () => {
    const obj = {
      value: 42,
      map: new Map([['a', 1]]),
      set: new Set([1, 2]),
      arr: [1, 2, 3]
    };

    const events: StateEvent[] = [
      { action: 'set', path: ['value'], newValue: 43 },
      { action: 'set', path: ['map', 'b'], newValue: 2 },
      { action: 'set-add', path: ['set'], value: 3 },
      { action: 'set', path: ['arr', '3'], newValue: 4 },
      { action: 'delete', path: ['map', 'a'] },
      { action: 'set-delete', path: ['set'], value: 1 },
      { action: 'array-splice', path: ['arr'], key: 0, deleteCount: 1 }
    ];

    events.forEach(event => updateState(obj, event));

    expect(obj.value).toBe(43);
    expect(obj.map.has('a')).toBe(false);
    expect(obj.map.get('b')).toBe(2);
    expect(Array.from(obj.set)).toEqual([2, 3]);
    expect(obj.arr).toEqual([2, 3, 4]);
  });

  test("updateState handles array-pop", () => {
    const state = { list: [1, 2, 3] };
    const event: StateEvent = { action: 'array-pop', path: ['list'] };
    updateState(state, event);
    expect(state.list).toEqual([1, 2]);
  });

  test("updateState handles array-shift", () => {
    const state = { list: [1, 2, 3] };
    const event: StateEvent = { action: 'array-shift', path: ['list'] };
    updateState(state, event);
    expect(state.list).toEqual([2, 3]);
  });

  test("updateState handles array-unshift", () => {
    const state = { list: [1, 2, 3] };
    const event: StateEvent = { action: 'array-unshift', path: ['list'], items: [0, -1] };
    updateState(state, event);
    expect(state.list).toEqual([0, -1, 1, 2, 3]);
  });

  test("updateState handles map-set (direct action)", () => {
    const state = { data: new Map([["a", 1]]) };
    const event: StateEvent = { action: 'map-set', path: ['data'], key: "b", newValue: 2 };
    updateState(state, event);
    expect(state.data.get("b")).toBe(2);
  });

  test("updateState handles map-delete", () => {
    const state = { data: new Map([["a", 1], ["b", 2]]) };
    const event: StateEvent = { action: 'map-delete', path: ['data'], key: "a" };
    updateState(state, event);
    expect(state.data.has("a")).toBe(false);
    expect(state.data.size).toBe(1);
  });

  test("updateState handles map-clear", () => {
    const state = { data: new Map([["a", 1], ["b", 2]]) };
    const event: StateEvent = { action: 'map-clear', path: ['data'] };
    updateState(state, event);
    expect(state.data.size).toBe(0);
  });

  test("updateState handles set-clear", () => {
    const state = { items: new Set([1, 2, 3]) };
    const event: StateEvent = { action: 'set-clear', path: ['items'] };
    updateState(state, event);
    expect(state.items.size).toBe(0);
  });
}); 