import { Pool } from "pg";
export async function prepareOptimizationIndexes(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("An explicit database URL is required.");
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
    throw new Error("Confirm the authorized migration target first.");
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
    connectionTimeoutMillis: 5000,
    statement_timeout: 120000,
    lock_timeout: 2000,
  });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(88421902)");
    const definitions = {
      barbershop_schedules_shop_day_barber_idx:
        "barbershop_schedules (barbershop_id, day_of_week, barberman_id)",
      schedule_exceptions_shop_date_barber_idx:
        "schedule_exceptions (barbershop_id, date, barberman_id)",
      notifications_user_created_id_idx:
        "notifications (user_id, created_at DESC, id DESC)",
      notifications_user_unread_idx:
        "notifications (user_id) WHERE read_at IS NULL",
    };
    const normalize = (value: string) =>
      value
        .replaceAll('"', "")
        .replaceAll("public.", "")
        .replace(/ USING btree/i, "")
        .replace(/\s+/g, " ")
        .replace(/\(read_at IS NULL\)/, "read_at IS NULL")
        .trim()
        .toLowerCase();
    for (const [name, definition] of Object.entries(definitions)) {
      const existing = await client.query(
        `SELECT i.indisvalid,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname=$1 AND n.nspname=current_schema()`,
        [name],
      );
      if (existing.rows.length) {
        if (
          !existing.rows[0].indisvalid ||
          !normalize(existing.rows[0].definition).endsWith(
            normalize("on " + definition),
          )
        )
          throw new Error(
            "An existing candidate index requires definition or validity review. No automatic removal is performed.",
          );
        continue;
      }
      // Each DDL command runs outside a transaction on this same pinned connection.
      await client.query(
        `CREATE INDEX CONCURRENTLY "${name}" ON ${definition}`,
      );
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(88421902)");
    } finally {
      client.release();
      await pool.end();
    }
  }
}
if (process.argv[1]?.endsWith("prepare-optimization-indexes.ts"))
  void prepareOptimizationIndexes()
    .then(() => console.log("Optimization indexes prepared and verified."))
    .catch(() => {
      console.error(
        "Index preparation failed; inspect index validity and target locally.",
      );
      process.exitCode = 1;
    });
