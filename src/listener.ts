import type { EmitFunction, StateEvent } from "./types";
import { activeEffect, batchDepth, flushing, setActiveEffect } from "./watch-effect";

/** Shared by every event descended from one caller write, including async events. */
export interface Delivery {
  writes: number;
  error: RangeError | undefined;
}

export let delivery: Delivery | undefined;
/** Tracking is paused, but writes still belong to the effect that called the listener. */
export let emittingEffect: typeof activeEffect = null;
let inListener = false;
const MAX_LISTENER_WRITE_ROUNDS = 100;

/** A queue keeps the caller's budget until every committed event has been delivered. */
export function beginDelivery(): boolean {
  if (delivery !== undefined) return false;
  delivery = { writes: 0, error: undefined };
  return true;
}

export function endDelivery(ownsDelivery: boolean): void {
  if (!ownsDelivery || (batchDepth > 0 || flushing) || inListener) return;
  const error = delivery?.error;
  delivery = undefined;
  if (error !== undefined) throw error;
}

/** Each listener-caused mutation uses one round, before it can change state. */
export function checkListenerWrite(): void {
  if (!inListener) return;
  const current = delivery ??= { writes: 0, error: undefined };
  if (current.writes < MAX_LISTENER_WRITE_ROUNDS) {
    current.writes++;
    return;
  }
  current.error ??= new RangeError(
    `reactive-proxy-state: listeners exceeded ${MAX_LISTENER_WRITE_ROUNDS} nested write rounds. ` +
    `Filter event paths to stop listener writes from repeating`
  );
  throw current.error;
}

/** Listener reads are untracked. Effects called inside a listener track their own reads. */
export function emitListener(emit: EmitFunction, event: StateEvent, queuedDelivery = delivery): void {
  const previousDelivery = delivery;
  const previousListener = inListener;
  const previousEffect = activeEffect;
  const previousEmittingEffect = emittingEffect;
  delivery = queuedDelivery;
  inListener = true;
  if (previousEffect !== null) {
    emittingEffect = previousEffect;
    setActiveEffect(null);
  }
  try {
    emit(event);
  } finally {
    if (previousEffect !== null) {
      setActiveEffect(previousEffect);
      emittingEffect = previousEmittingEffect;
    }
    const current = delivery;
    inListener = previousListener;
    delivery = previousDelivery ?? ((batchDepth > 0 || flushing) ? current : undefined);
    if (previousDelivery !== current && batchDepth === 0 && !flushing && current?.error !== undefined) throw current.error;
  }
}
