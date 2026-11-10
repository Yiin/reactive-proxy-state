import { expect, test } from "bun:test";
import { review318Cases } from "./review-318.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = review318Cases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./review-318.cases.mjs", Object.keys(cases).length);

// Every case but the ones that pin what 3.0.18 did right fails on the published 3.0.18.
test("the published 3.0.18 fails the cases of its review", async () => {
  const published = review318Cases(await import("./fixtures/published-3.0.18.js"));
  const failed: string[] = [];
  for (const [name, check] of Object.entries(published)) {
    try {
      await check();
    } catch {
      failed.push(name);
    }
  }
  expect(failed.sort()).toEqual(Object.keys(cases).filter((name) => !passedIn318.has(name)).sort());
});

/**
 * Cases 3.0.18 passed too: they pin what must not change. The Map and Set
 * case fails on 3.0.18 by its detached count (F1), the wide parent by its
 * symbol key (F2).
 */
const passedIn318 = new Set<string>([
  "a write inside a hidden-held object that left the tree is a detached write",
  "a hidden symbol key sends nothing",
  "an object a numeric-looking array name holds reads as an item and is sent there",
  "two roots: a hidden scope path sends to the other root, like a deleted one; shown again, to the scope",
  "a hidden key on the root sends nothing, also for writes inside its object",
]);
