type EffectCallback<T = any> = () => T;
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
}
export declare let activeEffect: TrackedEffect<any> | null;
export declare function setActiveEffect(effect: TrackedEffect<any> | null): void;
/**
 * Clean up dependencies for a specific effect
 */
export declare function cleanupEffect(effect: TrackedEffect<any>): void;
/**
 * Track a property access for the active effect
 */
export declare function track(target: object, key: string | symbol): void;
/**
 * Trigger effects associated with a property (Synchronous Only)
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
 * Runs a function and re-runs it when its reactive dependencies change.
 * Returns a stop handle that also exposes the effect instance.
 */
export declare function watchEffect<T>(effectCallback: EffectCallback<T>, options?: WatchEffectOptions): WatchEffectStopHandle<T>;
export {};
