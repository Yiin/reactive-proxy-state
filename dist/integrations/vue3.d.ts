import type { StateEvent } from "../types";
export type TrackVueReactiveEventsOptions = {
    emitInitialReplace?: boolean;
};
/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Returns a stop() function to tear down the watcher.
 */
export declare function trackVueReactiveEvents<T extends object>(vueState: T, emit: (event: StateEvent) => void, options?: TrackVueReactiveEventsOptions): () => void;
