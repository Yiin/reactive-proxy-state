/**
 * Converts reactive proxies/refs into plain JavaScript data structures
 * so they can be safely sent across structured-clone boundaries.
 */
export declare function deepToRaw<T>(input: T, seen?: WeakMap<any, any>): T;
