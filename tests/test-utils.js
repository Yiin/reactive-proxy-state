// Helper function to create an event emitter that collects events
export function createEventCollector() {
    const events = [];
    const emit = (event) => events.push(event);
    return { events, emit };
}
// Helper function to deep clone an object
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
