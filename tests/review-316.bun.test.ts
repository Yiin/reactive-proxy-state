import { expect, test } from "bun:test";
import { review316Cases } from "./review-316.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = review316Cases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./review-316.cases.mjs", Object.keys(cases).length);

// Every case but the ones about traps that ran the same in 3.0.16 fails on the published 3.0.16.
test("the published 3.0.16 fails the cases of its review", async () => {
  const published = review316Cases(await import("./fixtures/published-3.0.16.js"));
  const failed: string[] = [];
  for (const [name, check] of Object.entries(published)) {
    try {
      check();
    } catch {
      failed.push(name);
    }
  }
  expect(failed.sort()).toEqual(Object.keys(cases).filter((name) => !passedIn316.has(name)).sort());
});

/** Cases 3.0.16 passed too: they pin what must not change. */
const passedIn316 = new Set<string>([]);
