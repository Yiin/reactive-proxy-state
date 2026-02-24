import type { StateEvent } from "../types";
export type TrackVueReactiveEventsOptions = {
    emitInitialReplace?: boolean;
};
/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Uses per-key watchEffect partitioning: one effect per root key so that
 * only the affected subtree is diffed on mutation. A root structural effect
 * tracks Object.keys() for key add/delete at the top level.
 *
 * Returns a stop() function to tear down all effects.
 */
export declare function trackVueReactiveEvents<T extends object>(vueState: T, emit: (event: StateEvent) => void, options?: TrackVueReactiveEventsOptions): () => void;
