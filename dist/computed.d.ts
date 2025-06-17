import { WatchEffectStopHandle } from './watch-effect';
import { Ref, isRefSymbol } from './ref';
declare const isComputedSymbol: unique symbol;
export interface ComputedRef<T = any> extends Omit<Ref<T>, 'value'> {
    readonly value: T;
    readonly [isComputedSymbol]: true;
    readonly [isRefSymbol]: true;
    readonly stop: WatchEffectStopHandle<T>;
}
export interface WritableComputedRef<T> extends Ref<T> {
    readonly [isComputedSymbol]: true;
    readonly [isRefSymbol]: true;
    readonly stop: WatchEffectStopHandle<T>;
}
type ComputedGetter<T> = () => T;
type ComputedSetter<T> = (v: T) => void;
interface WritableComputedOptions<T> {
    get: ComputedGetter<T>;
    set: ComputedSetter<T>;
}
/**
 * Creates a computed ref from a getter function
 *
 * @param getter - The getter function
 * @returns A computed ref
 */
export declare function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;
export declare function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>;
export declare function isComputed<T>(c: any): c is ComputedRef<T> | WritableComputedRef<T>;
export {};
