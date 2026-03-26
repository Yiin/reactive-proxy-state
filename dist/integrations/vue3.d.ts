import type { StateEvent } from "../types";
export type DiffErrorContext = {
    key: string;
    path: (string | number | symbol)[];
    error: unknown;
};
export type TrackVueReactiveEventsOptions = {
    emitInitialReplace?: boolean;
    onDiffError?: (ctx: DiffErrorContext) => void;
};
export type VueTrackingControl = {
    /** Stop all effects permanently. */
    stop: () => void;
    /** Stop all effects temporarily. No diffing overhead while paused. */
    pause: () => void;
    /** Rebuild snapshots from current state and re-create effects. */
    resume: () => void;
};
/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Uses per-key watchEffect partitioning: one effect per root key so that
 * only the affected subtree is diffed on mutation. A root structural effect
 * tracks Object.keys() for key add/delete at the top level.
 *
 * Returns a control object with stop/pause/resume. Use pause/resume to
 * suppress diffing while applying external mutations (e.g. server events).
 */
export declare function trackVueReactiveEvents<T extends object>(vueState: T, emit: (event: StateEvent) => void, options?: TrackVueReactiveEventsOptions): VueTrackingControl;
