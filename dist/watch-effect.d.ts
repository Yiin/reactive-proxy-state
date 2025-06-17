type EffectCallback<T = any> = (onCleanup?: (cleanupFn: () => void) => void) => T;
type Scheduler = (job: () => void) => void;
export interface WatchEffectStopHandle<T = any> {
    (): void;
    effect: TrackedEffect<T>;
}
export interface TrackedEffect<T = any> {
    run: () => T;
    dependencies?: Set<Set<TrackedEffect<any>>>;
    options?: WatchEffectOptions;
    active?: boolean;
    _rawCallback: EffectCallback<T>;
    triggerDepth?: number;
    cleanupFns?: (() => void)[];
}
export declare let activeEffect: TrackedEffect<any> | null;
export declare function setActiveEffect(effect: TrackedEffect<any> | null): void;
/**
 * removes an effect from all dependency sets it belongs to.
 * this is crucial to prevent memory leaks and unnecessary updates when an effect is stopped or re-run.
 */
export declare function cleanupEffect(effect: TrackedEffect<any>): void;
/**
 * runs all cleanup functions registered for an effect and clears them.
 * called before re-running an effect or when stopping it.
 */
export declare function runCleanupFunctions(effect: TrackedEffect<any>): void;
/**
 * establishes a dependency between the currently active effect and a specific object property.
 * called by proxy getters or ref getters.
 */
export declare function track(target: object, key: string | symbol): void;
/**
 * triggers all active effects associated with a specific object property.
 * called by proxy setters/deleters or ref setters.
 * now batches effects to run in the same tick.
 */
export declare function trigger(target: object, key: string | symbol): void;
export interface WatchEffectOptions {
    lazy?: boolean;
    scheduler?: Scheduler;
    onTrack?: (event: {
        effect: EffectCallback<any>;
        target: object;
        key: string | symbol;
        type: 'track';
    }) => void;
    onTrigger?: (event: {
        effect: EffectCallback<any>;
        target: object;
        key: string | symbol;
        type: 'trigger';
    }) => void;
}
/**
 * runs a function immediately, tracks its reactive dependencies, and re-runs it
 * synchronously whenever any of those dependencies change.
 * returns a stop handle to manually stop the effect.
 */
export declare function watchEffect<T>(effectCallback: EffectCallback<T>, options?: WatchEffectOptions): WatchEffectStopHandle<T>;
export {};
