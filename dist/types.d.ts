export type Path = (string | number | symbol)[];
export type ActionType = 'set' | 'delete' | 'array-push' | 'array-pop' | 'array-splice' | 'array-shift' | 'array-unshift' | 'map-set' | 'map-delete' | 'map-clear' | 'set-add' | 'set-delete' | 'set-clear';
export interface StateEvent {
    action: ActionType;
    path: Path;
    oldValue?: any;
    newValue?: any;
    key?: any;
    value?: any;
    args?: any[];
    items?: any[];
    deleteCount?: number;
    oldValues?: any[];
}
export type EmitFunction = (event: StateEvent) => void;
