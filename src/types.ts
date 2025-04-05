// Type definitions
export type Path = (string | number | symbol)[];
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

export interface StateEvent {
  action: ActionType;
  path: Path;
  oldValue?: any; // For single value changes (set, pop, shift, map-delete)
  newValue?: any; // For single value changes (set, map-set)
  key?: any;      // For Map/Set keys or Array index
  value?: any;    // For Set values (set-add, set-delete)
  args?: any[];   // No longer used for array methods?
  items?: any[];  // For array-push, array-unshift, array-splice (added items)
  deleteCount?: number; // For array-splice
  oldValues?: any[]; // For array-splice (deleted items)
}

export type EmitFunction = (event: StateEvent) => void; 