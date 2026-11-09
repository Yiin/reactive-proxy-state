import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { methodCacheCases } from "./method-cache.cases.mjs";

const lib = await import(process.env.RPS_TEST_BUNDLE ?? "../src/index");
const cases = methodCacheCases(lib);
for (const [name, check] of Object.entries(cases)) test(name, check);

// Node runs the same cases on a bundle of the current source
const directory = mkdtempSync(fileURLToPath(new URL("./.method-cache-", import.meta.url)));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("the same cases pass under Node", async () => {
  const source = process.env.RPS_TEST_BUNDLE ?? join(directory, "index.mjs");
  if (process.env.RPS_TEST_BUNDLE === undefined) {
    const result = await Bun.build({
      entrypoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
      outdir: directory,
      naming: "index.mjs",
      target: "node",
      format: "esm",
      external: ["vue", "@vue/reactivity"],
    });
    if (!result.success) throw new Error(result.logs.join("\n"));
  }
  const script = fileURLToPath(new URL("./method-cache.cases.mjs", import.meta.url));
  const run = Bun.spawnSync(["node", script, source], { stdout: "pipe", stderr: "pipe" });
  expect({ exit: run.exitCode, error: new TextDecoder().decode(run.stderr) }).toEqual({ exit: 0, error: "" });
  expect(JSON.parse(new TextDecoder().decode(run.stdout))).toEqual({ runtime: "node", passed: Object.keys(cases).length });
});
