import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// JSC can conservatively retain stale stack words after explicit collection.
// Build the current source, then check its reference graph with Node's collector.
const directory = mkdtempSync(join(tmpdir(), "rps-retention-"));
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

for (const mode of ["objects", "values", "membership", "keys"]) {
  test(`a retained effect handle does not retain a discarded target through sibling effects (${mode})`, () => {
    const script = fileURLToPath(new URL("./retained-target-gc.mjs", import.meta.url));
    const result = Bun.spawnSync(["node", "--expose-gc", script, source, mode], { stdout: "pipe", stderr: "pipe" });
    expect({ exit: result.exitCode, error: new TextDecoder().decode(result.stderr) }).toEqual({ exit: 0, error: "" });
    expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({ samples: 30, retained: 0 });
  });
}
