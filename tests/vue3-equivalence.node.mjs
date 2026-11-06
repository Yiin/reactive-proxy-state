/**
 * The equivalence fuzz (tests/vue3-equivalence.ops.mjs) under Node, on two
 * installed packages, for example npm aliases of the published 2.0.0 tarball
 * and of a candidate tarball. Copy this file and vue3-equivalence.ops.mjs into
 * a folder whose node_modules holds vue and both packages, then run there:
 *   node vue3-equivalence.node.mjs <reference package> <candidate package> [seeds] [ops]
 * NODE_ENV=production selects Vue's production build. Prints a JSON summary
 * and exits with 1 when a check fails.
 */
import { reactive, toRaw } from "vue";
import { runEquivalenceFuzz } from "./vue3-equivalence.ops.mjs";

const [referenceName, candidateName, seedsArg, opsArg] = process.argv.slice(2);
if (!referenceName || !candidateName) {
  console.error("usage: node vue3-equivalence.node.mjs <reference package> <candidate package> [seeds] [ops]");
  process.exit(2);
}
const reference = await import(referenceName);
const candidate = await import(candidateName);
const started = performance.now();
const result = runEquivalenceFuzz({
  lib: { reactive, toRaw, updateState: reference.updateState, deepEqual: reference.deepEqual },
  reference: reference.trackVueReactiveEvents,
  candidate: candidate.trackVueReactiveEvents,
  seeds: Number(seedsArg ?? 1000),
  ops: Number(opsArg ?? 300),
});
console.log(JSON.stringify({ ...result, failures: result.failures.length, ms: Math.round(performance.now() - started) }));
for (const failure of result.failures) console.error(JSON.stringify(failure).slice(0, 2000));
process.exit(result.failures.length === 0 ? 0 : 1);
