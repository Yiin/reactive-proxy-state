import { expect, test, describe } from "bun:test";
import { wrapState } from '../src/index';
// Helper function to create an event emitter that collects events
function createEventCollector() {
    const events = [];
    const emit = (event) => events.push(event);
    return { events, emit };
}
describe("Wrap State Tests", () => {
    test("wrapState handles Date objects", () => {
        const { events, emit } = createEventCollector();
        const date = new Date('2024-01-01');
        const state = wrapState({ date }, emit);
        state.date = new Date('2024-01-02');
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('set');
        expect(events[0].path[0]).toBe('date');
        expect(events[0].newValue).toEqual(new Date('2024-01-02'));
    });
    test("wrapState handles deep equality check", () => {
        const { events, emit } = createEventCollector();
        const state = wrapState({ obj: { value: 42 } }, emit);
        state.obj = { value: 42 }; // Same value, should not emit
        state.obj = { value: 43 }; // Different value, should emit
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('set');
        expect(events[0].path[0]).toBe('obj');
        expect(events[0].newValue).toEqual({ value: 43 });
    });
    test("wrapState handles nested object creation", () => {
        const { events, emit } = createEventCollector();
        const state = wrapState({ obj: {} }, emit);
        state.obj.nested = { value: 42 };
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('set');
        expect(events[0].path).toEqual(['obj', 'nested']);
        expect(events[0].newValue).toEqual({ value: 42 });
    });
    test("wrapState handles property deletion", () => {
        const { events, emit } = createEventCollector();
        const state = wrapState({ obj: { prop: 42 } }, emit);
        delete state.obj.prop;
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('delete');
        expect(events[0].path).toEqual(['obj', 'prop']);
    });
    test("wrapState handles nested property deletion", () => {
        const { events, emit } = createEventCollector();
        const state = wrapState({
            nested: {
                deep: {
                    value: 42
                }
            }
        }, emit);
        delete state.nested.deep.value;
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('delete');
        expect(events[0].path).toEqual(['nested', 'deep', 'value']);
    });
    test("wrapState handles circular references", () => {
        const { events, emit } = createEventCollector();
        const obj = { value: 42 };
        obj.self = obj;
        const state = wrapState({ obj }, emit);
        state.obj.value = 43;
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('set');
        expect(events[0].path).toEqual(['obj', 'value']);
        expect(events[0].newValue).toBe(43);
    });
});
