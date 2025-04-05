import { EmitFunction, Path } from './types';
export declare function reactive<T extends object>(obj: T, emit: EmitFunction, path?: Path, seen?: WeakMap<any, any>): T;
