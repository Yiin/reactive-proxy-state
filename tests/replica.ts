import { reactive, updateState, toRaw } from "../src/index";
import type { ReactiveOptions, StateEvent } from "../src/types";

/**
 * A copy with one copy per place: an object that sits at two places in
 * `value` becomes two objects, the way a wire (JSON) carries it.
 */
export function copyTree<T>(value: T): T {
  return copyInto(value, []);
}

function copyInto(value: any, ancestors: object[]): any {
  if (value === null || typeof value !== "object") return value;
  value = toRaw(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (ancestors.includes(value)) throw new Error("copyTree: cycle");
  ancestors.push(value);
  let copy: any;
  if (Array.isArray(value)) copy = value.map((item) => copyInto(item, ancestors));
  else if (value instanceof Map) copy = new Map([...value].map(([key, item]) => [key, copyInto(item, ancestors)]));
  else if (value instanceof Set) copy = new Set([...value].map((item) => copyInto(item, ancestors)));
  else {
    copy = {};
    for (const key of Object.keys(value)) copy[key] = copyInto(value[key], ancestors);
  }
  ancestors.pop();
  return copy;
}

/** A stable text form of a tree, for comparing source and replica. */
export function treeText(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: any): any {
  if (value === null || typeof value !== "object") return value;
  value = toRaw(value);
  if (Array.isArray(value)) {
    const out: any[] = [];
    for (let i = 0; i < value.length; i++) out.push(i in value ? normalize(value[i]) : "<hole>");
    return out;
  }
  if (value instanceof Map) return { map: [...value].map(([key, item]) => [key, normalize(item)]) };
  if (value instanceof Set) return { set: [...value].map(normalize) };
  const out: any = {};
  for (const key of Object.keys(value).sort()) out[key] = normalize(value[key]);
  return out;
}

/**
 * A reactive root and a remote replica fed only by its events. Each event
 * crosses a wire (structuredClone) when it is delivered, so a payload that
 * changed after the event was made reaches the replica changed.
 */
export function replicate<T extends object>(raw: T, options?: ReactiveOptions) {
  const remote = copyTree(raw);
  const events: StateEvent[] = [];
  let initial = true;
  const state = reactive(
    raw,
    (event) => {
      if (initial) {
        initial = false;
        return;
      }
      const wire = structuredClone(event);
      events.push(wire);
      updateState(remote, wire);
    },
    [],
    options
  );
  return {
    state,
    raw,
    remote,
    events,
    paths: () => events.map((event) => `${event.action}:${event.path.join(".")}`),
    inSync: () => treeText(raw) === treeText(remote),
    clear: () => {
      events.length = 0;
    },
  };
}
