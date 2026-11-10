import { test } from "bun:test";
import { arrayDefineCases } from "./array-define.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = arrayDefineCases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./array-define.cases.mjs", Object.keys(cases).length);
