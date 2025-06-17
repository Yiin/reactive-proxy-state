import { WatchSource, UnwrapWatchSource, UnwrapWatchSources } from './types';
type WatchCallback<T, O> = (newValue: T, oldValue: O) => void;
type WatchStopHandle = () => void;
export interface WatchOptions {
    immediate?: boolean;
    deep?: boolean;
}
export declare function watch<T extends readonly WatchSource<unknown>[], Immediate extends Readonly<boolean> = false>(sources: [...T], callback: WatchCallback<UnwrapWatchSources<T>, Immediate extends true ? (UnwrapWatchSources<T> | undefined) : UnwrapWatchSources<T>>, options?: WatchOptions): WatchStopHandle;
export declare function watch<T, Immediate extends Readonly<boolean> = false>(source: () => T, callback: WatchCallback<T, Immediate extends true ? T | undefined : T>, options?: WatchOptions): WatchStopHandle;
export declare function watch<T, Immediate extends Readonly<boolean> = false>(source: WatchSource<T>, callback: WatchCallback<UnwrapWatchSource<T>, Immediate extends true ? (UnwrapWatchSource<T> | undefined) : UnwrapWatchSource<T>>, options?: WatchOptions): WatchStopHandle;
export {};
