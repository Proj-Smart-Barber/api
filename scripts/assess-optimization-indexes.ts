import { Pool } from "pg";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
const target =
  "postgresql://sb_opt_bench:sb_opt_bench_local_only@127.0.0.1:55432/smartbarber_opt_bench_isolated";
const parsed = new URL(target);
if (
  parsed.hostname !== "127.0.0.1" ||
  parsed.port !== "55432" ||
  parsed.pathname !== "/smartbarber_opt_bench_isolated"
)
  throw new Error(
    "Index assessment refused outside its owned disposable database.",
  );
const pool = new Pool({
  connectionString: target,
  max: 2,
  statement_timeout: 30000,
});
const names = [
  "membership_user_state_shop_idx",
  "barbershop_schedules_shop_day_barber_idx",
  "schedule_exceptions_shop_date_barber_idx",
  "notifications_user_created_id_idx",
  "notifications_user_unread_idx",
  "bookings_customer_starts_at_id_idx",
  "shopping_carts_user_id_idx",
  "bookings_shop_barber_starts_at_id_idx",
];
async function main() {
  const identity = await pool.query("SELECT current_database() AS name");
  if (identity.rows[0].name !== parsed.pathname.slice(1))
    throw new Error("Unexpected database identity.");
  const shop = (
    await pool.query(
      `SELECT id,owner_id FROM barbershops WHERE slug NOT LIKE 'opt-index-scale-%' ORDER BY created_at,id LIMIT 1`,
    )
  ).rows[0];
  const barber = (
    await pool.query(
      `SELECT barberman_id FROM bookings WHERE barbershop_id=$1 AND starts_at>='2026-11-20' AND starts_at<'2026-11-21' GROUP BY barberman_id ORDER BY COUNT(*) DESC LIMIT 1`,
      [shop.id],
    )
  ).rows[0].barberman_id;
  const customer = (
    await pool.query(
      "SELECT customer_id FROM bookings WHERE customer_id IS NOT NULL GROUP BY customer_id ORDER BY COUNT(*) DESC LIMIT 1",
    )
  ).rows[0].customer_id;
  const user = (
    await pool.query(
      "SELECT user_id,COUNT(*) FROM notifications GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1",
    )
  ).rows[0].user_id;
  await pool.query(
    `INSERT INTO barbershops(name,owner_id,slug,cnpj,location)
   SELECT 'Synthetic index scale', $1,'opt-index-scale-'||n,'opt-index-scale-'||n,'Synthetic location' FROM generate_series(1,5000)n ON CONFLICT(slug) DO NOTHING`,
    [shop.owner_id],
  );
  await pool.query(
    `INSERT INTO barbershop_schedules(barbershop_id,barberman_id,created_by,day_of_week,open_time,close_time)
   SELECT s.id,$1,$2,day,'09:00','18:00' FROM barbershops s CROSS JOIN unnest(ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']) day
   WHERE s.slug LIKE 'opt-index-scale-%' AND NOT EXISTS(SELECT 1 FROM barbershop_schedules b WHERE b.barbershop_id=s.id)`,
    [barber, shop.owner_id],
  );
  await pool.query(`INSERT INTO schedule_exceptions(barbershop_id,date,reason)
   SELECT s.id, '2026-01-01'::timestamp+n*INTERVAL '1 day','Synthetic index scale' FROM barbershops s CROSS JOIN generate_series(1,10)n
   WHERE s.slug LIKE 'opt-index-scale-%' AND NOT EXISTS(SELECT 1 FROM schedule_exceptions e WHERE e.barbershop_id=s.id)`);
  await pool.query(
    `INSERT INTO notifications(user_id,type,title,message,scheduled_at,read_at)
   SELECT $1,'INFO','Synthetic index scale','Synthetic index scale',NOW(),CASE WHEN n%2=0 THEN NOW() END
   FROM generate_series(1,20000)n WHERE NOT EXISTS(SELECT 1 FROM notifications WHERE title='Synthetic index scale')`,
    [shop.owner_id],
  );
  await pool.query("ANALYZE");
  const candidates = await pool.query(
    `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[])`,
    [names],
  );
  const statements = new Map(
    candidates.rows.map((row) => [String(row.indexname), String(row.indexdef)]),
  );
  const definitionsFile = "index-candidate-definitions.json";
  if (statements.size === names.length)
    writeFileSync(
      definitionsFile,
      JSON.stringify(Object.fromEntries(statements), null, 2),
    );
  else if (existsSync(definitionsFile)) {
    const saved = JSON.parse(readFileSync(definitionsFile, "utf8"));
    for (const name of names)
      if (!statements.has(name) && typeof saved[name] === "string")
        statements.set(name, saved[name]);
  }
  if (statements.size !== names.length)
    throw new Error("Expected candidate definitions were not found.");
  for (const name of names)
    if (!candidates.rows.some((row) => row.indexname === name))
      await pool.query(statements.get(name)!);
  const constraints = await pool.query(
    `SELECT c.conname FROM pg_constraint c JOIN pg_class i ON i.oid=c.conindid WHERE i.relname=ANY($1::text[])`,
    [names],
  );
  if (constraints.rows.length)
    throw new Error("Refusing to remove an index backing a constraint.");
  const cases: Record<string, { sql: string; values: unknown[] }> = {
    membership_user_state_shop_idx: {
      sql: "SELECT barbershop_id FROM membership WHERE user_id=$1 AND state='ACTIVE'",
      values: [shop.owner_id],
    },
    barbershop_schedules_shop_day_barber_idx: {
      sql: "SELECT * FROM barbershop_schedules WHERE barbershop_id=$1 AND day_of_week='MONDAY' AND (barberman_id IS NULL OR barberman_id=$2)",
      values: [shop.id, barber],
    },
    schedule_exceptions_shop_date_barber_idx: {
      sql: "SELECT * FROM schedule_exceptions WHERE barbershop_id=$1 AND date>='2026-11-25' AND date<'2026-11-26' AND (barberman_id IS NULL OR barberman_id=$2)",
      values: [shop.id, barber],
    },
    notifications_user_created_id_idx: {
      sql: "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 21",
      values: [user],
    },
    notifications_user_unread_idx: {
      sql: "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL",
      values: [user],
    },
    bookings_customer_starts_at_id_idx: {
      sql: "SELECT b.* FROM bookings b LEFT JOIN shopping_carts c ON c.id=b.shopping_cart_id WHERE b.customer_id=$1 OR c.user_id=$1 ORDER BY COALESCE(b.starts_at,b.date) DESC,b.id DESC LIMIT 20",
      values: [customer],
    },
    shopping_carts_user_id_idx: {
      sql: "SELECT b.* FROM bookings b JOIN shopping_carts c ON c.id=b.shopping_cart_id WHERE c.user_id=$1 ORDER BY COALESCE(b.starts_at,b.date) DESC,b.id DESC LIMIT 20",
      values: [customer],
    },
    bookings_shop_barber_starts_at_id_idx: {
      sql: "SELECT * FROM bookings WHERE barbershop_id=$1 AND barberman_id=$2 AND starts_at>='2026-11-20' AND starts_at<'2026-11-21' ORDER BY starts_at,id LIMIT 20",
      values: [shop.id, barber],
    },
  };
  const measure = async () => {
    const result: Record<string, unknown> = {};
    for (const [name, query] of Object.entries(cases)) {
      await pool.query(query.sql, query.values);
      const response = await pool.query(
        "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) " + query.sql,
        query.values,
      );
      const plan = response.rows[0]["QUERY PLAN"][0];
      const used: string[] = [];
      const walk = (node: any) => {
        if (node["Index Name"]) used.push(node["Index Name"]);
        for (const child of node.Plans ?? []) walk(child);
      };
      walk(plan.Plan);
      result[name] = {
        executionMs: plan["Execution Time"],
        buffers: plan.Plan["Shared Hit Blocks"] ?? 0,
        indexes: used,
        rows: plan.Plan["Actual Rows"],
      };
    }
    return result;
  };
  let before: Record<string, unknown> = {},
    after: Record<string, unknown> = {};
  try {
    for (const name of names) await pool.query('DROP INDEX "' + name + '"');
    before = await measure();
  } finally {
    for (const ddl of statements.values()) await pool.query(ddl);
  }
  after = await measure();
  const tables = await pool.query(
    `SELECT relname,n_live_tup FROM pg_stat_user_tables WHERE relname=ANY($1::text[]) ORDER BY relname`,
    [
      [
        "barbershops",
        "barbershop_schedules",
        "schedule_exceptions",
        "notifications",
        "bookings",
      ],
    ],
  );
  writeFileSync(
    "index-assessment.json",
    JSON.stringify(
      {
        environment:
          "owned disposable PostgreSQL 16; synthetic growth dataset, not the baseline HTTP dataset",
        tables: tables.rows,
        before,
        after,
      },
      null,
      2,
    ),
  );
  for (const name of names)
    console.log(
      name,
      JSON.stringify({ before: before[name], after: after[name] }),
    );
}
void main()
  .catch(() => {
    console.error("Isolated index assessment failed. Check local diagnostics.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
