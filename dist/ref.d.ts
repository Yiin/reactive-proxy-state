export declare const isRefSymbol: unique symbol;
export interface Ref<T = any> {
    value: T;
    readonly [isRefSymbol]: true;
}
/**
 * creates a reactive reference object.
 * the object has a single `.value` property.
 * reactivity is tracked on access and mutation of the `.value` property.
 * if an object is passed as the initial value, the object itself is *not* made deeply reactive.
 * only the assignment to `.value` is tracked.
 */
export declare function ref<T>(value: T): Ref<T>;
export declare function ref<T = undefined>(): Ref<T | undefined>;
/**
 * checks if a value is a ref object.
 */
export declare function isRef<T>(r: any): r is Ref<T>;
/**
 * returns the inner value if the argument is a ref,
 * otherwise returns the argument itself. this is a sugar for `isRef(val) ? val.value : val`.
 */
export declare function unref<T>(refValue: T | Ref<T>): T;
/**
 * Converts an object's properties to reactive refs.
 * This is useful when you want to destructure reactive objects but maintain reactivity.
 * @param object The reactive object to convert to refs
 * @returns An object with the same properties, where each property is a ref connected to the original object
 */
export declare function toRefs<T extends object>(object: T): {
    [K in keyof T]: Ref<T[K]>;
};
/**
 * Creates a ref that is connected to a property on an object.
 * @param object The source object
 * @param key The property key
 * @returns A ref connected to the object's property
 */
export declare function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]>;
