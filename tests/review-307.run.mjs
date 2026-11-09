/**
 * The effect oracle and removed-value properties on a built bundle, over
 * many seeds, with counts.
 * Run with: node tests/review-307.run.mjs <bundle> [seeds] [runs per seed] [wide runs per seed]
 */
import fc from "fast-check";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { oracleArbitrary, runOracle, wideOracleArbitrary } from "./effect-oracle.model.mjs";
import { oldValueArbitrary, runOldValue } from "./old-value-property.model.mjs";
const lib = await import(pathToFileURL(resolve(process.argv[2])).href);
const seeds = Number(process.argv[3] ?? 40);
const runs = Number(process.argv[4] ?? 500);
const wideRuns = Number(process.argv[5] ?? 50);
let effectRuns = 0;
let writes = 0;
let wideEffectRuns = 0;
let wideWrites = 0;
let wideReached = 0;
let widest = 0;
for (let seed = 1; seed <= seeds; seed++) {
  fc.assert(fc.property(oracleArbitrary, spec => {
    const result = runOracle(lib, spec);
    effectRuns += result.runs;
    writes += result.writes;
    if (result.failure) throw new Error(JSON.stringify(result.failure));
  }), { seed, numRuns: runs });
  fc.assert(fc.property(wideOracleArbitrary, spec => {
    const result = runOracle(lib, spec);
    wideEffectRuns += result.runs;
    wideWrites += result.writes;
    if (result.widest > 100) wideReached++;
    widest = Math.max(widest, result.widest);
    if (result.failure) throw new Error(JSON.stringify(result.failure));
  }), { seed, numRuns: wideRuns });
  fc.assert(fc.property(oldValueArbitrary, spec => {
    const result = runOldValue(lib, spec);
    return result.observed === result.expected;
  }), { seed, numRuns: runs });
  // let the job end: WeakRef targets the library reads stay alive until then
  await new Promise(resolve => setTimeout(resolve, 0));
}
console.log(JSON.stringify({
  seeds, runs, oracleCases: seeds * runs, oldValueCases: seeds * runs, effectRuns, writes,
  wideCases: seeds * wideRuns, wideEffectRuns, wideWrites, wideReached, widest,
}));
