type WatchCallback<T = any> = (newValue: T, oldValue: T | undefined) => void;
type WatchSource<T = any> = () => T;
type WatchSourceInput<T = any> = WatchSource<T> | T;
type WatchStopHandle = () => void;
export interface WatchOptions {
    immediate?: boolean;
    deep?: boolean;
}
/**
 * Watches a reactive source and runs a callback when it changes
 *
 * @param source - A function that returns the value to watch
 * @param callback - Function to call when the source changes
 * @param options - Watch options (immediate, deep)
 * @returns A function to stop watching
 */
export declare function watch<T = any>(sourceInput: WatchSourceInput<T>, // Renamed parameter
callback: WatchCallback<T>, options?: WatchOptions): WatchStopHandle;
export {};
