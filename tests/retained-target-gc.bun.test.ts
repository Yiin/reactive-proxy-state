import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const mode of ["values", "membership"]) {
test(`a retained effect handle does not retain a discarded target through sibling effects (${mode})`, () => {
  const script = fileURLToPath(new URL("./retained-target-gc.mjs", import.meta.url));
  const source = process.env.RPS_TEST_BUNDLE ?? fileURLToPath(new URL("../src/index.ts", import.meta.url));
  const result = Bun.spawnSync([process.execPath, "--expose-gc", script, source, mode], { stdout: "pipe", stderr: "pipe" });
  expect({ exit: result.exitCode, error: new TextDecoder().decode(result.stderr) }).toEqual({ exit: 0, error: "" });
  expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({ samples: 30, retained: 0 });
});

}
