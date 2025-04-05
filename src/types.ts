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
  | 'set-clear';

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