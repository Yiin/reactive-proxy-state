/**
 * The replica property of tests/replica-property.bun.test.ts on built
 * bundles, over many seeds, with counts.
 * Run with: node tests/replica-property.run.mjs <bundle> <3.0.6 bundle> [seeds] [runs per seed]
 * Fails when the replica of `bundle` differs from its source after a
 * write, or when a case 3.0.6's order applies to (see `comparable`, and
 * `comparableWhenFinite` for listener writes 3.0.6 ends) sends other
 * events than 3.0.6.
 */
import fc from "fast-check";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { caseArbitrary, classify, comparable, comparableWhenFinite, runCase } from "./replica-property.model.mjs";

const [bundle, baselineBundle, seedArg, runArg] = process.argv.slice(2);
if (bundle === undefined || baselineBundle === undefined) {
  console.error("usage: node tests/replica-property.run.mjs <bundle> <3.0.6 bundle> [seeds] [runs per seed]");
  process.exit(2);
}
const lib = await import(pathToFileURL(resolve(bundle)).href);
const baseline = await import(pathToFileURL(resolve(baselineBundle)).href);
const seeds = Number(seedArg ?? 20);
const runs = Number(runArg ?? 500);

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
  baselineReplicaDiffers: 0,
};
const failures = [];
for (let seed = 1; seed <= seeds; seed++) {
  console.error(`replica seed ${seed}/${seeds}`);
  const result = fc.check(
    fc.property(caseArbitrary(), (spec) => {
      const ours = runCase(lib, spec);
      const strict = comparable(spec);
      const finite = !strict && comparableWhenFinite(spec) ? runCase(baseline, spec, { stopLoops: true }) : undefined;
      const theirs = strict ? runCase(baseline, spec) : finite !== undefined && !finite.looped ? finite : undefined;
      const kinds = classify(spec);
      const same = theirs !== undefined && ours.log.join("\n") === theirs.log.join("\n");
      counts.cases++;
      counts.writes += spec.writes.length;
      counts.events += ours.log.filter((line) => !line.startsWith("threw ") && !line.startsWith("skipped ")).length;
      counts.errors += ours.log.filter((line) => line.startsWith("threw ")).length;
      counts.boundReports += ours.log.filter(line => line.includes("refused a listener write")).length;
      if (strict) counts.comparable++;
      if (finite !== undefined) counts[finite.looped ? "baselineLooped" : "finiteListenerWrites"]++;
      for (const kind of ["srjbj9", "hooks", "listenerReads", "queued"]) if (kinds[kind]) counts[kind]++;
      if (same) counts.sameAsBaseline++;
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
      baseline: comparable(spec) ? runCase(baseline, spec) : comparableWhenFinite(spec) ? runCase(baseline, spec, { stopLoops: true }) : "excluded: listener tracking",
      kinds: classify(spec),
    });
    if (failures.length >= 3) break;
  }
}
console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? `node ${process.version}` : `bun ${Bun.version}`, seeds, runs, counts, failures }, null, 1));
if (failures.length > 0) process.exit(1);
