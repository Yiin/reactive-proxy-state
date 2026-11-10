import { expect, test } from "bun:test";
import { review317Cases } from "./review-317.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = review317Cases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./review-317.cases.mjs", Object.keys(cases).length);

// Every case but the ones that pin what 3.0.17 did right fails on the published 3.0.17.
test("the published 3.0.17 fails the cases of its review", async () => {
  const published = review317Cases(await import("./fixtures/published-3.0.17.js"));
  const failed: string[] = [];
  for (const [name, check] of Object.entries(published)) {
    try {
      check();
    } catch {
      failed.push(name);
    }
  }
  expect(failed.sort()).toEqual(Object.keys(cases).filter((name) => !passedIn317.has(name)).sort());
});

/** Cases 3.0.17 passed too: they pin what must not change. */
const passedIn317 = new Set<string>([
  "a hidden accessor made data by writable alone sends nothing and reruns its readers",
  "a hidden key deleted and written again by = is shown, on objects and arrays",
  "a listener's hidden write past the depth limit is refused like any write",
  "a write inside a hidden array item is sent",
  "an array name that holds an object reads it raw, hidden or not",
  "an outer proxy that hides the key on the way: a new key sends nothing, a shown key sends delete",
]);
