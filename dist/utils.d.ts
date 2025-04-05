export declare const pathCache: WeakMap<object, Map<string, any>>;
export declare const pathConcatCache: Map<string, any[]>;
export declare const globalSeen: WeakMap<any, any>;
export declare const wrapperCache: WeakMap<object, object>;
export declare function deepEqual(a: any, b: any, seen?: WeakMap<any, any>): boolean;
export declare function getFromPathCache(root: object, pathKey: string): any | undefined;
export declare function setInPathCache(root: object, pathKey: string, value: any): void;
export declare function getPathConcat(path: string): any[] | undefined;
export declare function setPathConcat(path: string, value: any[]): void;
/**
 * Recursively traverses an object to track all nested properties.
 * Used for deep watching.
 * @param value - The value to traverse.
 * @param seen - A Set to handle circular references.
 */
export declare function traverse(value: any, seen?: Set<any>): any;
/**
 * Creates a deep clone of a value.
 * Handles primitives, Dates, Arrays, Maps, Sets, and plain objects.
 * Includes cycle detection.
 * @param value The value to clone.
 * @param seen A WeakMap to handle circular references during recursion.
 * @returns A deep clone of the value.
 */
export declare function deepClone<T>(value: T, seen?: WeakMap<WeakKey, any>): T;
