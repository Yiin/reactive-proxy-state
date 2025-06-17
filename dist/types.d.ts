export type Path = (string | number | symbol)[];
export type ActionType = 'set' | 'delete' | 'array-push' | 'array-pop' | 'array-splice' | 'array-shift' | 'array-unshift' | 'map-set' | 'map-delete' | 'map-clear' | 'set-add' | 'set-delete' | 'set-clear' | 'replace';
export interface StateEvent {
    action: ActionType;
    path: Path;
    newValue?: any;
    oldValue?: any;
    key?: any;
    value?: any;
    items?: any[];
    deleteCount?: number;
    oldValues?: any[];
}
export type EmitFunction = (event: StateEvent) => void;
import { Ref } from './ref';
import { ComputedRef } from './computed';
export type BaseWatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);
export type WatchSource<T = any> = BaseWatchSource<T> | T;
export type UnwrapWatchSource<T> = T extends BaseWatchSource<infer V> ? V : T extends object ? T : T;
export type UnwrapWatchSources<T> = {
    -readonly [K in keyof T]: UnwrapWatchSource<T[K]>;
};
