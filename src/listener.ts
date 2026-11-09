import type { EmitFunction, StateEvent } from "./types";
import { activeEffect, setActiveEffect, writeDepth } from "./watch-effect";

/** Shared by every event descended from one caller write, including async events. */
export interface Delivery {
  writes: number;
  error: RangeError | undefined;
}

export let delivery: Delivery | undefined;
let inListener = false;
const MAX_LISTENER_WRITE_ROUNDS = 100;

/** A queue keeps the caller's budget until every committed event has been delivered. */
export function beginDelivery(): boolean {
  if (delivery !== undefined) return false;
  delivery = { writes: 0, error: undefined };
  return true;
}

export function endDelivery(ownsDelivery: boolean): void {
  if (!ownsDelivery || writeDepth > 0 || inListener) return;
  const error = delivery?.error;
  delivery = undefined;
  if (error !== undefined) throw error;
}

/** Each listener-caused mutation uses one round, before it can change state. */
export function checkListenerWrite(): void {
  if (!inListener) return;
  const current = delivery!;
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
  const current = queuedDelivery ?? { writes: 0, error: undefined };
  delivery = current;
  inListener = true;
  if (previousEffect !== null) setActiveEffect(null);
  try {
    emit(event);
  } finally {
    if (previousEffect !== null) setActiveEffect(previousEffect);
    inListener = previousListener;
    delivery = previousDelivery ?? (writeDepth > 0 ? current : undefined);
    if (previousDelivery !== current && writeDepth === 0 && current.error !== undefined) throw current.error;
  }
}
