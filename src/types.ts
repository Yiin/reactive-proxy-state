// represents a path to a nested property
export type Path = (string | number | symbol)[];

// possible types of state change actions
export type ActionType = 
  | 'set'
  | 'delete'
  | 'array-push'
  | 'array-pop'
  | 'array-splice'
  | 'array-shift'
  | 'array-unshift'
  | 'map-set'
  | 'map-delete'
  | 'map-clear'
  | 'set-add'
  | 'set-delete'
  | 'set-clear'
  | 'replace';

// represents a single state change event emitted by reactive proxies
export interface StateEvent {
  action: ActionType;
  path: Path; // path to the object/collection mutated (or parent for set/delete)

  // --- fields relevant to specific actions ---
  newValue?: any;  // for set, map-set
  oldValue?: any;  // for set, delete, array-pop, array-shift, map-delete, set-delete
  key?: any;       // for map-set, map-delete, array-splice (start index)
  value?: any;     // for set-add, set-delete
  items?: any[];   // for array-push, array-unshift, array-splice (items added)
  deleteCount?: number; // for array-splice
  oldValues?: any[];   // for array-splice (items removed)
}

// callback used to emit state change events
export type EmitFunction = (event: StateEvent) => void;

// --- New code below ---

import { Ref } from './ref';
import { ComputedRef } from './computed';

// --- Watcher Types ---

// Base type for anything that can be "unwrapped" to a value.
// It can be a Ref, a ComputedRef, or a getter function.
export type BaseWatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

// A watch source can be a single unwrappable source or a plain object/value.
// This is what the user provides to the watch function.
export type WatchSource<T = any> = BaseWatchSource<T> | T;

// Type helper to infer the unwrapped value type from a single source.
// This is the core of the solution.
export type UnwrapWatchSource<T> = T extends BaseWatchSource<infer V>
  ? V // For Ref<V>, ComputedRef<V>, or () => V, the unwrapped type is V.
  : T extends object
  ? T // For a plain object, the unwrapped type is the object itself.
  : T; // For primitives, the type is the primitive itself.

// Type helper to map a tuple of watch sources to their unwrapped value types.
// Example: from [Ref<number>, () => string] to [number, string]
export type UnwrapWatchSources<T> = {
  -readonly [K in keyof T]: UnwrapWatchSource<T[K]>
};
