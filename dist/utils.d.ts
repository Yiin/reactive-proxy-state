export declare const pathCache: WeakMap<object, Map<string, any>>;
export declare const pathConcatCache: Map<string, any[]>;
export declare const globalSeen: WeakMap<any, any>;
export declare const wrapperCache: WeakMap<object, object>;
export declare function deepEqual(a: any, b: any, seen?: WeakMap<any, any>): boolean;
export declare function getFromPathCache(root: object, pathKey: string): any | undefined;
export declare function setInPathCache(root: object, pathKey: string, value: any): void;
/**
 * Evict all cached paths that are descendants of the given path prefix.
 * Called when a value at `pathKey` is replaced so that deeper cached references
 * (which now point to the old, detached object) are not reused.
 */
export declare function evictDescendantsFromPathCache(root: object, pathKey: string): void;
export declare function getPathConcat(path: string): any[] | undefined;
export declare function setPathConcat(path: string, value: any[]): void;
/**
 * recursively traverses an object or array, accessing each property/element.
 * used by `watch` with `deep: true` to establish dependencies on all nested properties.
 * the actual tracking is done by the proxy `get` handlers triggered during traversal.
 */
export declare function traverse(value: any, seen?: Set<any>): any;
/**
 * creates a deep clone of a value.
 * includes cycle detection using a weakmap.
 */
export declare function deepClone<T>(value: T, seen?: WeakMap<WeakKey, any>): T;
