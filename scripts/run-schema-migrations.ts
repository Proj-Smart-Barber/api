// DATABASE_URL must be supplied explicitly; this entry point does not load an env file.
async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("An explicit DATABASE_URL is required.");
  const target = new URL(raw);
  const local =
    ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) &&
    target.port === "55432" &&
    /^\/(?:smartbarber_opt_bench_isolated|sb_[a-z0-9_]+(?:_test|_isolated))$/.test(
      target.pathname,
    );
  if (
    !local &&
    process.env.MIGRATION_TARGET_CONFIRMED !== target.pathname.slice(1)
  )
    throw new Error(
      "Migration refused: confirm the authorized target database explicitly.",
    );
  if (
    target.hash ||
    [...target.searchParams.keys()].some(
      (key) => !["sslmode", "channel_binding"].includes(key),
    )
  )
    throw new Error(
      "Connection URL options are not allowed by the release runner.",
    );
  if (!local)
    await (
      await import("./prepare-optimization-indexes")
    ).prepareOptimizationIndexes();
  const { runSchemaMigrations } = await import("../src/infra/drizzle/migrator");
  const { pool } = await import("../src/infra/drizzle");
  try {
    const result = await runSchemaMigrations();
    if (!result.success) throw new Error("Release schema migration failed.");
    console.log("Release schema is ready.");
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Schema release failed; check target, schema compatibility and local diagnostics.",
  );
  process.exitCode = 1;
});
