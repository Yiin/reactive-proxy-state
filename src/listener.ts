import type { EmitFunction, StateEvent } from "./types";
import { activeEffect, batchDepth, flushing, setActiveEffect } from "./watch-effect";

/** Shared by every event descended from one caller write, including async events. */
export interface Delivery {
  rounds: number;
  error: RangeError | undefined;
}

export let delivery: Delivery | undefined;
/** Tracking is paused, but writes still belong to the effect that called the listener. */
export let emittingEffect: typeof activeEffect = null;
const enum ListenerState { Inactive, BeforeWrite, AfterWrite }
let listenerState = ListenerState.Inactive;
const MAX_LISTENER_WRITE_ROUNDS = 100;

/** A queue keeps the caller's budget until every committed event has been delivered. */
export function beginDelivery(): boolean {
  if (delivery !== undefined) return false;
  delivery = { rounds: 0, error: undefined };
  return true;
}

export function endDelivery(ownsDelivery: boolean): void {
  if (!ownsDelivery || (batchDepth > 0 || flushing) || listenerState !== ListenerState.Inactive) return;
  const error = delivery?.error;
  delivery = undefined;
  if (error !== undefined) throw error;
}

/** A callback uses one round when it first attempts a write, before mutation. */
export function checkListenerWrite(): void {
  if (listenerState !== ListenerState.BeforeWrite) return;
  const current = delivery ??= { rounds: 0, error: undefined };
  if (current.rounds < MAX_LISTENER_WRITE_ROUNDS) {
    current.rounds++;
    listenerState = ListenerState.AfterWrite;
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
  const previousListener = listenerState;
  const previousEffect = activeEffect;
  // Ordinary synchronous delivery needs no context switch or allocation.
  if (previousEffect === null && queuedDelivery === delivery) {
    listenerState = ListenerState.BeforeWrite;
    try {
      emit(event);
    } finally {
      listenerState = previousListener;
      if (delivery !== undefined && batchDepth === 0 && !flushing) endDelivery(true);
    }
    return;
  }
  const previousDelivery = delivery;
  const previousEmittingEffect = emittingEffect;
  delivery = queuedDelivery;
  listenerState = ListenerState.BeforeWrite;
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
    listenerState = previousListener;
    delivery = previousDelivery ?? ((batchDepth > 0 || flushing) ? current : undefined);
    if (previousDelivery !== current && batchDepth === 0 && !flushing && current?.error !== undefined) throw current.error;
  }
}
