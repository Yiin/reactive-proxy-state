import { EmitFunction, Path, ReactiveOptions } from "./types";
import { LocationNode } from "./location";
/**
 * Checks if an object is a reactive proxy
 */
export declare function isReactive(value: any): boolean;
/**
 * Create a reactive proxy for an object.
 *
 * Called by users, this makes a root: events from anywhere below it go to
 * `emit`, with paths that start with `path`. Nested objects are wrapped on
 * read by `wrapChild`.
 */
export declare function reactive<T extends object>(obj: T, emit?: EmitFunction, path?: Path, options?: ReactiveOptions): T;
/**
 * The proxy for `raw`, which a read found at `parent[key]`. Records that
 * place, so the proxy's events name where the object is now.
 */
export declare function wrapChild(raw: any, parent: LocationNode, key: unknown, options?: ReactiveOptions): any;
/** The proxy for an object that has no place of its own (a map key). */
export declare function wrapUnplaced(raw: any): any;
