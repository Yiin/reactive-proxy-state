export declare const isRefSymbol: unique symbol;
export interface Ref<T = any> {
    value: T;
    readonly [isRefSymbol]: true;
}
/**
 * Takes an inner value and returns a reactive and mutable ref object,
 * which has a single property `.value` that points to the inner value.
 * The ref tracks access and mutations to its `.value` property.
 * If the initial value is an object, it is NOT automatically made reactive.
 */
export declare function ref<T>(value: T): Ref<T>;
export declare function ref<T = undefined>(): Ref<T | undefined>;
/**
 * Checks if a value is a ref object.
 */
export declare function isRef<T>(r: any): r is Ref<T>;
/**
 * Returns the inner value if the argument is a ref, otherwise returns the
 * argument itself.
 */
export declare function unref<T>(refValue: T | Ref<T>): T;
