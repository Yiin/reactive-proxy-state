import { EmitFunction, Path } from './types';
export declare function wrapMap<K, V>(map: Map<K, V>, emit?: EmitFunction, path?: Path, seen?: WeakMap<any, any>): Map<K, V>;
