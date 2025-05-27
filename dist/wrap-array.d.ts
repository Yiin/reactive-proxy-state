import { EmitFunction, Path } from './types';
export declare function wrapArray<T extends any[]>(arr: T, emit?: EmitFunction, path?: Path, seen?: WeakMap<any, any>): T;
