import { test } from "bun:test";
import { setterRuleCases } from "./setter-rule.cases.mjs";
import { casesUnderNode } from "./node-cases";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = setterRuleCases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
casesUnderNode("./setter-rule.cases.mjs", Object.keys(cases).length);
