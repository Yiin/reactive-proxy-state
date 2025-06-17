/**
 * Marks an object so that it will never be converted into a reactive proxy.
 *
 * Similar to Vue's `markRaw`, this is useful when you need to store
 * non-reactive, opaque objects (e.g. DOM nodes, complex class instances,
 * third-party library objects) inside a reactive tree without having them
 * wrapped by the reactivity system.
 */
export declare function markRaw<T extends object>(obj: T): T;
