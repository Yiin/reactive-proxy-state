import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A test that runs the cases of `script` (a `.cases.mjs` file in tests/)
 * under Node, on `RPS_TEST_BUNDLE` or else on a bundle of the current
 * source built in a temporary directory (`tests/.node-cases-*`, ignored by git), and expects `count` to pass.
 */
export function casesUnderNode(script: string, count: number): void {
  test("the same cases pass under Node", async () => {
    const node = Bun.which("node");
    if (node === null) throw new Error("this test runs the cases under Node: put node on PATH");
    // in tests/, so that Node finds the packages the bundle imports
    const directory = mkdtempSync(fileURLToPath(new URL("./.node-cases-", import.meta.url)));
    try {
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
      const run = Bun.spawnSync([node, fileURLToPath(new URL(script, import.meta.url)), source], {
        stdout: "pipe",
        stderr: "pipe",
      });
      expect({ exit: run.exitCode, error: new TextDecoder().decode(run.stderr) }).toEqual({ exit: 0, error: "" });
      expect(JSON.parse(new TextDecoder().decode(run.stdout))).toEqual({ runtime: "node", passed: count });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
