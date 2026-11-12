import { Pool } from "pg";
async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Explicit target required.");
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
    throw new Error("Confirm the authorized target first.");
  if (
    target.hash ||
    [...target.searchParams.keys()].some(
      (key) => !["sslmode", "channel_binding"].includes(key),
    )
  )
    throw new Error("Unsupported connection options.");
  const pool = new Pool({
    connectionString: raw,
    max: 1,
    statement_timeout: 5000,
    lock_timeout: 1000,
  });
  try {
    if (!process.argv.includes("--apply")) {
      const result = await pool.query(
        "SELECT COUNT(*) AS candidates FROM (SELECT 1 FROM explore_feed_snapshots WHERE expires_at<NOW() LIMIT 500) rows",
      );
      console.log(
        "Dry run; up to",
        result.rows[0].candidates,
        "expired snapshots in the next batch.",
      );
      return;
    }
    const result = await pool.query(
      "WITH expired AS (SELECT id FROM explore_feed_snapshots WHERE expires_at<NOW() ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED) DELETE FROM explore_feed_snapshots WHERE id IN (SELECT id FROM expired)",
    );
    console.log("Expired snapshots removed:", result.rowCount);
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error("Snapshot maintenance failed; no shared target is assumed.");
  process.exitCode = 1;
});
