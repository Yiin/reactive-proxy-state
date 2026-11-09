import fc from "fast-check";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { oracleArbitrary, runOracle } from "./effect-oracle.model.mjs";
import { oldValueArbitrary, runOldValue } from "./old-value-property.model.mjs";
const lib = await import(pathToFileURL(resolve(process.argv[2])).href);
const seeds = Number(process.argv[3] ?? 40);
const runs = Number(process.argv[4] ?? 500);
let effectRuns = 0;
let writes = 0;
for (let seed = 1; seed <= seeds; seed++) {
  fc.assert(fc.property(oracleArbitrary, spec => {
    const result = runOracle(lib, spec);
    effectRuns += result.runs;
    writes += result.writes;
    if (result.failure) throw new Error(JSON.stringify(result.failure));
  }), { seed, numRuns: runs });
  fc.assert(fc.property(oldValueArbitrary, spec => {
    const result = runOldValue(lib, spec);
    return result.observed === result.expected;
  }), { seed, numRuns: runs });
}
console.log(JSON.stringify({ seeds, runs, oracleCases: seeds * runs, oldValueCases: seeds * runs, effectRuns, writes }));
