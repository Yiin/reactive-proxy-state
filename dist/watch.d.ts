type WatchCallback<T = any> = (newValue: T, oldValue: T | undefined) => void;
type WatchSource<T = any> = () => T;
type WatchSourceInput<T = any> = WatchSource<T> | T;
type WatchStopHandle = () => void;
export interface WatchOptions {
    immediate?: boolean;
    deep?: boolean;
}
/**
 * watches a reactive source (getter function or reactive object/ref)
 * and runs a callback when the source's value changes.
 */
export declare function watch<T = any>(sourceInput: WatchSourceInput<T>, callback: WatchCallback<T>, options?: WatchOptions): WatchStopHandle;
export {};
