import { expect, test, describe } from "bun:test";
import { wrapState } from '../src/index';
// Helper function to create an event emitter that collects events
function createEventCollector() {
    const events = [];
    const emit = (event) => events.push(event);
    return { events, emit };
}
describe("Primitive Tests", () => {
    test("primitive set emits event", () => {
        const { events, emit } = createEventCollector();
        const state = wrapState({ value: 42 }, emit);
        state.value = 43;
        expect(events.length).toBe(1);
        expect(events[0].action).toBe('set');
        expect(events[0].path[0]).toBe('value');
        expect(events[0].newValue).toBe(43);
    });
});
