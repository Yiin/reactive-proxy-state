import { describe, expect, test } from "bun:test";
import { toRaw } from "../src/index";
import { replicate } from "./replica";

/**
 * `splice` normalizes its arguments the way the spec does (ToIntegerOrInfinity,
 * clamping, omitted versus explicit undefined). The wrapper uses the same
 * numbers for the change, the removed items, the new places and the event.
 */

type Call = { name: string; args: unknown[] };

const calls: Call[] = [
  { name: "fractional start", args: [0.5, 1] },
  { name: "fractional start and count", args: [1.9, 1.9] },
  { name: "NaN start", args: [NaN, 1] },
  { name: "NaN count", args: [1, NaN] },
  { name: "negative start", args: [-2, 1] },
  { name: "negative fractional start", args: [-1.5, 1] },
  { name: "start below -length", args: [-10, 1] },
  { name: "start past the end with items", args: [99, 0, { id: "X", n: 0 }] },
  { name: "Infinity start with items", args: [Infinity, 1, { id: "X", n: 0 }] },
  { name: "-Infinity start", args: [-Infinity, 1] },
  { name: "negative count", args: [1, -2] },
  { name: "Infinity count", args: [1, Infinity] },
  { name: "count omitted", args: [1] },
  { name: "count explicit undefined", args: [1, undefined] },
  { name: "start explicit undefined", args: [undefined, 1] },
  { name: "start as a numeric string", args: ["1", "1"] },
  { name: "no arguments", args: [] },
  { name: "negative zero start with items", args: [-0, 0, { id: "X", n: 0 }] },
];

const list = () => ["A", "B", "C", "D"].map((id) => ({ id, n: 0 }));

describe("splice argument normalization", () => {
  for (const { name, args } of calls) {
    test(name, () => {
      const native = list();
      const nativeRemoved = (native.splice as Function)(...structuredClone(args));

      const sync = replicate({ list: list() });
      const retained = ["A", "B", "C", "D"].map((_, index) => sync.state.list[index]);
      const removed = (sync.state.list.splice as Function)(...structuredClone(args));

      expect(removed.map((entry: any) => toRaw(entry).id)).toEqual(nativeRemoved.map((entry: any) => entry.id));
      expect(toRaw(sync.state.list).map((entry) => entry.id)).toEqual(native.map((entry) => entry.id));
      expect(sync.inSync()).toBe(true);

      const splices = sync.events.filter((event) => event.action === "array-splice");
      for (const event of splices) {
        expect(Number.isInteger(event.key)).toBe(true);
        expect(Object.is(event.key, -0)).toBe(false);
        expect(Number.isInteger(event.deleteCount)).toBe(true);
      }

      // every survivor writes at its new index; a removed one writes nowhere
      sync.clear();
      for (const proxy of retained) proxy.n++;
      const ids = toRaw(sync.state.list).map((entry) => entry.id);
      const expected = retained
        .map((proxy) => toRaw(proxy).id)
        .filter((id) => ids.includes(id))
        .map((id) => `set:list.${ids.indexOf(id)}.n`);
      expect(sync.paths()).toEqual(expected);
      expect(sync.inSync()).toBe(true);
    });
  }
});
