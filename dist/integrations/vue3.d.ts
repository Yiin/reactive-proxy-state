import type { StateEvent } from "../types";
export type DiffErrorContext = {
    /** The first key of `path`, or '' when the failure is in the root object itself. */
    key: string;
    /** Path of the event whose listener threw, or of the object whose scan failed. */
    path: (string | number | symbol)[];
    error: unknown;
};
export type TrackVueReactiveEventsOptions = {
    emitInitialReplace?: boolean;
    onDiffError?: (ctx: DiffErrorContext) => void;
};
export type VueTrackingControl = {
    /** Stop tracking for good. A stopped tracker cannot restart: pause() and resume() after stop() only warn. */
    stop: () => void;
    /** Stop sending events. Writes still keep the tracker's copy of the state in step, so resume() costs nothing. */
    pause: () => void;
    /** Send events again. Writes made while paused are never sent. */
    resume: () => void;
};
/**
 * Observe a Vue 3 reactive object and emit RPS-compatible StateEvents
 * for each mutation performed through Vue reactivity.
 *
 * Every object and array in the state gets its own small Vue effect (a node)
 * that reads only its own entries, so a write re-runs only the node it changed.
 * Each node keeps a plain copy of its entries and diffs against it with the
 * rules 2.0.0 used, so the events are the same: leaf-level sets, deletes,
 * array grows as per-index sets, shrinks as one `length` set, a type change as
 * one whole-value set. A Map or Set is one node that reads the whole collection
 * and emits `map-set` / `set-add` with whole values.
 *
 * Returns a control object with stop/pause/resume. Use pause/resume around
 * writes that must not be sent back (e.g. server events).
 */
export declare function trackVueReactiveEvents<T extends object>(vueState: T, emit: (event: StateEvent) => void, options?: TrackVueReactiveEventsOptions): VueTrackingControl;
