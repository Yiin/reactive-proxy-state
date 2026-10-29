/**
 * Deep trees under Node, whose stack is smaller than Bun's.
 * Run with: node tests/deep-trees.node.mjs [bundle] [depths]
 * The bundle defaults to dist/index.js; pass dist/index.cjs for CommonJS.
 * Exits with 1 when a check fails.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { runDeepChecks } from "./deep-trees.ops.mjs";

const bundle = resolve(process.argv[2] ?? new URL("../dist/index.js", import.meta.url).pathname);
const depths = (process.argv[3] ?? "8000,100000").split(",").map(Number);
const lib = bundle.endsWith(".cjs") ? createRequire(import.meta.url)(bundle) : await import(pathToFileURL(bundle).href);

let failed = 0;
for (const depth of depths) {
  const started = performance.now();
  const failures = runDeepChecks(lib, depth);
  failed += failures.length;
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(`depth ${depth}: ${failures.length} failures, ${Math.round(performance.now() - started)} ms`);
}
process.exit(failed === 0 ? 0 : 1);
