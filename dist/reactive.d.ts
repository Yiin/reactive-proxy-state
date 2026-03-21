import { EmitFunction, Path, ReactiveOptions } from "./types";
/**
 * Checks if an object is a reactive proxy
 */
export declare function isReactive(value: any): boolean;
/**
 * Returns the raw, original object underlying a reactive proxy.
 * If the input is not a proxy, returns the input itself.
 */
export declare function toRaw<T>(observed: T): T;
/**
 * Create a reactive proxy for an object
 */
export declare function reactive<T extends object>(obj: T, emit?: EmitFunction, path?: Path, options?: ReactiveOptions): T;
