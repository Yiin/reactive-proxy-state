import { StateEvent } from "../src/types";

// Helper function to create an event emitter that collects events
export function createEventCollector(): { events: StateEvent[], emit: (event: StateEvent) => void } {
  const events: StateEvent[] = [];
  const emit = (event: StateEvent) => events.push(event);
  return { events, emit };
}

// Helper function to deep clone an object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
} 