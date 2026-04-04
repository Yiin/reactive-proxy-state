import { EmitFunction, Path, ReactiveOptions } from "./types";
/**
 * Checks if an object is a reactive proxy
 */
export declare function isReactive(value: any): boolean;
/**
 * Create a reactive proxy for an object
 */
export declare function reactive<T extends object>(obj: T, emit?: EmitFunction, path?: Path, options?: ReactiveOptions): T;
