import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Node's collector checks that keys written through one outer proxy are not
// kept (see receiver-keys-gc.mjs). The bundle sits in tests/ so Node finds its packages.
const directory = mkdtempSync(fileURLToPath(new URL("./.node-cases-", import.meta.url)));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
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
const script = fileURLToPath(new URL("./receiver-keys-gc.mjs", import.meta.url));
const run = (bundle: string, mode: string) => {
  const result = Bun.spawnSync(["node", "--expose-gc", script, bundle, mode], { stdout: "pipe", stderr: "pipe" });
  return { exit: result.exitCode, out: new TextDecoder().decode(result.stdout), error: new TextDecoder().decode(result.stderr) };
};

for (const mode of ["strings", "symbols"]) {
  test(`keys written through one outer proxy are not kept (${mode})`, () => {
    const result = run(source, mode);
    expect({ exit: result.exit, error: result.error }).toEqual({ exit: 0, error: "" });
  });
  test(`the check finds the keys the published 3.0.16 kept (${mode})`, () => {
    expect(run(fileURLToPath(new URL("./fixtures/published-3.0.16.js", import.meta.url)), mode).exit).not.toBe(0);
  });
}
