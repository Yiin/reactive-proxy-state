import type { EmitFunction, StateEvent } from "./types";
import { activeEffect } from "./watch-effect";
/** Shared by every event descended from one caller write, including async events. */
export interface Delivery {
    rounds: number;
    error: RangeError | undefined;
}
export declare let delivery: Delivery | undefined;
/** Tracking is paused, but writes still belong to the effect that called the listener. */
export declare let emittingEffect: typeof activeEffect;
/** A queue keeps the caller's budget until every committed event has been delivered. */
export declare function beginDelivery(): boolean;
export declare function endDelivery(ownsDelivery: boolean): void;
/** A callback uses one round when it first attempts a write, before mutation. */
export declare function checkListenerWrite(): void;
/** Listener reads are untracked. Effects called inside a listener track their own reads. */
export declare function emitListener(emit: EmitFunction, event: StateEvent, queuedDelivery?: Delivery | undefined): void;
