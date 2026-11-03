const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  mkdtempSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const folder = mkdtempSync(join(tmpdir(), "media-guard-"));
const file = join(folder, "fixture.env");
// Sentinel credentials never reach a database, R2 or the process arguments.
writeFileSync(
  file,
  "DATABASE_URL=postgresql://fixture:sentinel-private@127.0.0.1:9/fixture\n",
);
try {
  const cases = [
    [],
    [
      `--env-file=${file}`,
      "--expected-host=wrong.invalid",
      "--expected-database=fixture",
    ],
    [
      `--env-file=${file}`,
      "--expected-host=127.0.0.1",
      "--expected-database=fixture",
      "--apply",
    ],
    [
      `--env-file=${file}`,
      "--expected-host=127.0.0.1",
      "--expected-database=fixture",
      "--apply",
      "--confirm=IMPORTAR_MIDIAS_DEMO",
    ],
  ];
  for (const args of cases) {
    const run = spawnSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/admin-import-demo-media.ts",
        ...args,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(run.status, 1);
    assert.ok(
      !run.stdout.includes("sentinel-private") &&
        !run.stderr.includes("sentinel-private"),
    );
    const result = JSON.parse(run.stderr.trim());
    assert.equal(result.phase, "preflight");
    assert.ok(result.reason);
  }
  console.log("4 offline safety guards passed; no database or R2 accessed.");
} finally {
  unlinkSync(file);
  rmdirSync(folder);
}
