import { Ref, isRefSymbol } from './ref';
declare const isComputedSymbol: unique symbol;
export interface ComputedRef<T = any> extends Omit<Ref<T>, 'value'> {
    readonly value: T;
    readonly [isComputedSymbol]: true;
    readonly [isRefSymbol]: true;
}
export interface WritableComputedRef<T> extends Ref<T> {
}
type ComputedGetter<T> = () => T;
export declare function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;
/**
 * Checks if a value is a computed ref.
 */
export declare function isComputed<T>(c: any): c is ComputedRef<T>;
export {};
