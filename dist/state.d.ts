import { StateEvent } from './types';
/**
 * Applies a state change event to a plain javascript object/array (the target state)
 *
 * @param root - The root object/array to apply the event to
 * @param event - The state change event to apply
 */
export declare function updateState(root: any, event: StateEvent): void;
