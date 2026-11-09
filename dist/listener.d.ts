import type { EmitFunction, StateEvent } from "./types";
import { activeEffect } from "./watch-effect";
/** Tracking is paused, but writes still belong to the effect that called the listener. */
export declare let emittingEffect: typeof activeEffect;
/** The generation of the events a write made now sends. */
export declare function writeGeneration(): number;
/** The generation of the event the running listener received. */
export declare function listenerGeneration(): number;
/** A listener call uses its round with its first write, before mutation. */
export declare function checkListenerWrite(): void;
/** Async delivery microtasks hold their operation until every queued event is delivered. */
export declare function beginAsyncDelivery(): void;
/** Is `error` the bound's refusal, thrown out of a listener? */
export declare function isRefusal(error: unknown): boolean;
/**
 * The end of an async delivery. No caller waits for it, and a throw out of
 * a microtask ends a Node process, so the bound's error is logged.
 */
export declare function endAsyncDelivery(): void;
/**
 * Deliver `event`, of `generation`, to `emit`. Listener reads are untracked.
 * Effects called inside a listener track their own reads.
 */
export declare function emitListener(emit: EmitFunction, event: StateEvent, generation: number): void;
