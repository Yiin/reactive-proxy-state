import { expect, test, describe } from "bun:test";
import { updateState } from '../src/index';
describe("Update State Tests", () => {
    test("updateState applies set", () => {
        const obj = { value: 42 };
        const event = {
            action: 'set',
            path: ['value'],
            newValue: 43
        };
        updateState(obj, event);
        expect(obj.value).toBe(43);
    });
    test("updateState applies map-set", () => {
        const obj = { map: new Map([['a', 1]]) };
        const event = {
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
        const events = [
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
});
