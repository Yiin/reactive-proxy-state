import type { EmitFunction, StateEvent } from "./types";
import { activeEffect, batchDepth, flushing, setActiveEffect } from "./watch-effect";

/**
 * Listener writes are bounded by how deep they nest, not by how many there
 * are. Every event has a generation: a write made outside a listener sends
 * events of generation 0, and a write a listener makes while it receives an
 * event of generation `g` sends events of generation `g + 1`. A queued event
 * keeps its generation until it is delivered. A listener write of a
 * generation past `MAX_LISTENER_WRITE_DEPTH` is refused before mutation.
 *
 * One listener call that writes uses one round, with its first write; its
 * other writes share that round. Rounds of generation 2 and deeper also
 * count toward `MAX_LISTENER_WRITE_ROUNDS` in one operation, which bounds
 * loops that branch (a listener that writes twice for each event).
 * Generation 1 rounds answer the caller's own events, so the caller's write
 * bounds them: a long `length` grow, an alias at many places, or many
 * effect writes never reach the total. Loops through effects stay bounded
 * by the effect loop limit of the flush.
 *
 * An operation is a write, ref or trigger made outside listeners, with its
 * delivery and its effect flush, or one async delivery microtask. After
 * the first refusal every further listener write of the operation is
 * refused, so its committed events and effects drain. Then the caller gets
 * the `RangeError`; an async delivery logs it instead.
 */
const MAX_LISTENER_WRITE_DEPTH = 100;
const MAX_LISTENER_WRITE_ROUNDS = 100_000;

/**
 * The running listener call: -1 outside listeners, otherwise the generation
 * of the event it received times 2, plus 1 once it used its round. One
 * number, so a delivery saves and restores one variable.
 */
let listening = -1;
/** Tracking is paused, but writes still belong to the effect that called the listener. */
export let emittingEffect: typeof activeEffect = null;
/** Async delivery microtasks running: they end their operation themselves. */
let asyncDeliveries = 0;
/** Rounds of generation 2 and deeper in this operation. */
let rounds = 0;
let refusal: RangeError | undefined;

/** The generation of the events a write made now sends. */
export function writeGeneration(): number {
  return (listening >> 1) + 1;
}

/** The generation of the event the running listener received. */
export function listenerGeneration(): number {
  return listening >> 1;
}

/** A listener call uses its round with its first write, before mutation. */
export function checkListenerWrite(): void {
  if (listening < 0) return;
  if (refusal !== undefined) throw refusal;
  if ((listening & 1) !== 0) return;
  const generation = listening >> 1;
  if (
    generation < MAX_LISTENER_WRITE_DEPTH &&
    (generation === 0 || ++rounds <= MAX_LISTENER_WRITE_ROUNDS)
  ) {
    listening |= 1;
    return;
  }
  refusal ??= new RangeError(
    generation >= MAX_LISTENER_WRITE_DEPTH
      ? `reactive-proxy-state: refused a listener write nested ${generation + 1} deep ` +
        `(at most ${MAX_LISTENER_WRITE_DEPTH}). Filter event paths to stop listener writes from repeating`
      : `reactive-proxy-state: refused a listener write after ${MAX_LISTENER_WRITE_ROUNDS} nested rounds ` +
        `in one operation. Filter event paths to stop listener writes from repeating`
  );
  throw refusal;
}

/**
 * End the operation when nothing encloses it: the outermost write, ref or
 * trigger outside listeners and flushes ended, or a listener called outside
 * every write returned. Throws the bound's error, in place of any other.
 * @internal
 */
export function endOperation(): void {
  if ((rounds === 0 && refusal === undefined) || listening >= 0 || asyncDeliveries > 0) return;
  rounds = 0;
  const error = refusal;
  if (error === undefined) return;
  refusal = undefined;
  throw error;
}

/** Async delivery microtasks hold their operation until every queued event is delivered. */
export function beginAsyncDelivery(): void {
  asyncDeliveries++;
}

/** Is `error` the bound's refusal, thrown out of a listener? */
export function isRefusal(error: unknown): boolean {
  return error === refusal && error !== undefined;
}

/**
 * The end of an async delivery. No caller waits for it, and a throw out of
 * a microtask ends a Node process, so the bound's error is logged.
 */
export function endAsyncDelivery(): void {
  asyncDeliveries--;
  rounds = 0;
  const error = refusal;
  if (error === undefined) return;
  refusal = undefined;
  console.error(error);
}

/**
 * Deliver `event`, of `generation`, to `emit`. Listener reads are untracked.
 * Effects called inside a listener track their own reads.
 */
export function emitListener(emit: EmitFunction, event: StateEvent, generation: number): void {
  if (activeEffect !== null) {
    emitUntracked(emit, event, generation);
    return;
  }
  const previous = listening;
  listening = generation << 1;
  try {
    emit(event);
  } finally {
    listening = previous;
    if (previous < 0 && batchDepth === 0 && !flushing) endOperation();
  }
}

/** `emitListener` while an effect runs: its tracking pauses for the listener. */
function emitUntracked(emit: EmitFunction, event: StateEvent, generation: number): void {
  const previous = listening;
  const previousEffect = activeEffect;
  const previousEmittingEffect = emittingEffect;
  emittingEffect = previousEffect;
  setActiveEffect(null);
  listening = generation << 1;
  try {
    emit(event);
  } finally {
    setActiveEffect(previousEffect);
    emittingEffect = previousEmittingEffect;
    listening = previous;
    if (previous < 0 && batchDepth === 0 && !flushing) endOperation();
  }
}
