/**
 * The replica property of tests/replica-property.bun.test.ts on built
 * bundles, over many seeds, with counts.
 * Run with: node tests/replica-property.run.mjs <bundle> <baseline bundle> [seeds] [runs per seed] [exact|catch]
 * Fails when the replica of `bundle` differs from its source after a
 * write, or when a case 3.0.6's order applies to (see `comparable`, and
 * `comparableWhenFinite` for listener writes 3.0.6 ends) sends other
 * events than 3.0.6.
 * `exact` compares every case and every log byte with the baseline.
 * `catch` compares listeners that catch errors and retry writes.
 */
import fc from "fast-check";
import { listenerCatchArbitrary, runListenerCatchCase } from "./listener-catch.model.mjs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { caseArbitrary, classify, comparable, comparableWhenFinite, runCase, sameEventLog } from "./replica-property.model.mjs";

const [bundle, baselineBundle, seedArg, runArg, mode] = process.argv.slice(2);
if (bundle === undefined || baselineBundle === undefined) {
  console.error("usage: node tests/replica-property.run.mjs <bundle> <baseline bundle> [seeds] [runs per seed] [exact|catch]");
  process.exit(2);
}
const lib = await import(pathToFileURL(resolve(bundle)).href);
const baseline = await import(pathToFileURL(resolve(baselineBundle)).href);
const seeds = Number(seedArg ?? 20);
const runs = Number(runArg ?? 500);

if (mode === "catch") {
  const counts = { cases: 0, events: 0, retries: 0, rejected: 0, caught: 0, refusals: 0, swallowed: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    console.error(`listener catch seed ${seed}/${seeds}`);
    fc.assert(fc.property(listenerCatchArbitrary, spec => {
      const ours = runListenerCatchCase(lib, spec);
      const theirs = runListenerCatchCase(baseline, spec);
      counts.cases++;
      counts.events += ours.log.filter(line => !line.startsWith("retry threw ") && !line.startsWith("caught ") && !line.startsWith("caller threw ")).length;
      counts.retries += ours.attempts;
      counts.rejected += ours.rejected;
      counts.caught += ours.caught;
      if (spec.refusal) counts.refusals++;
      if (spec.swallow) counts.swallowed++;
      if (ours.mismatch !== undefined || theirs.mismatch !== undefined || JSON.stringify(ours) !== JSON.stringify(theirs)) {
        throw new Error(JSON.stringify({ spec, ours, theirs }));
      }
    }), { seed, numRuns: runs });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? `node ${process.version}` : `bun ${Bun.version}`, mode, seeds, runs, counts }));
  process.exit(0);
}

const counts = {
  cases: 0,
  comparable: 0,
  srjbj9: 0,
  hooks: 0,
  listenerReads: 0,
  queued: 0,
  writes: 0,
  events: 0,
  errors: 0,
  boundReports: 0,
  finiteListenerWrites: 0,
  baselineLooped: 0,
  sameAsBaseline: 0,
  fewerMapKeyErrors: 0,
  baselineReplicaDiffers: 0,
};
const failures = [];
for (let seed = 1; seed <= seeds; seed++) {
  console.error(`replica seed ${seed}/${seeds}`);
  const result = fc.check(
    fc.property(caseArbitrary(), (spec) => {
      const ours = runCase(lib, spec);
      const strict = mode === "exact" || comparable(spec);
      const finite = !strict && comparableWhenFinite(spec) ? runCase(baseline, spec, { stopLoops: true }) : undefined;
      const theirs = strict ? runCase(baseline, spec) : finite !== undefined && !finite.looped ? finite : undefined;
      const kinds = classify(spec);
      const exact = theirs !== undefined && ours.log.join("\n") === theirs.log.join("\n");
      const same = theirs !== undefined && (mode === "exact" ? exact : sameEventLog(spec, ours, theirs));
      counts.cases++;
      counts.writes += spec.writes.length;
      counts.events += ours.log.filter((line) => !line.startsWith("threw ") && !line.startsWith("skipped ")).length;
      counts.errors += ours.log.filter((line) => line.startsWith("threw ")).length;
      counts.boundReports += ours.log.filter(line => line.includes("refused a listener write")).length;
      if (strict) counts.comparable++;
      if (finite !== undefined) counts[finite.looped ? "baselineLooped" : "finiteListenerWrites"]++;
      for (const kind of ["srjbj9", "hooks", "listenerReads", "queued"]) if (kinds[kind]) counts[kind]++;
      if (same) counts.sameAsBaseline++;
      if (same && !exact) counts.fewerMapKeyErrors++;
      if (theirs?.mismatch !== undefined) counts.baselineReplicaDiffers++;
      if (ours.mismatch !== undefined) return false;
      return theirs === undefined || same;
    }),
    { seed, numRuns: runs }
  );
  if (result.failed) {
    const spec = result.counterexample[0];
    failures.push({
      seed,
      spec,
      ours: runCase(lib, spec),
      baseline: mode === "exact" || comparable(spec) ? runCase(baseline, spec) : comparableWhenFinite(spec) ? runCase(baseline, spec, { stopLoops: true }) : "excluded: listener tracking",
      kinds: classify(spec),
    });
    if (failures.length >= 3) break;
  }
  // WeakRef targets the library reads stay alive until the current job ends,
  // so a run that never yields keeps every case's state; listener loops that
  // reach the round total made that more than Node's heap
  await new Promise((resolve) => setTimeout(resolve, 0));
}
console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? `node ${process.version}` : `bun ${Bun.version}`, seeds, runs, counts, failures }, null, 1));
if (failures.length > 0) process.exit(1);
