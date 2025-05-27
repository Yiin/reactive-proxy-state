import { EmitFunction, Path } from './types';
export declare function wrapSet<T>(set: Set<T>, emit?: EmitFunction, path?: Path, seen?: WeakMap<any, any>): Set<T>;
