/** Destructive maintenance CLI; no HTTP route or implicit deployment action. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { rootCertificates } from "node:tls";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, is, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

const argument = (name: string) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const fingerprint = async (client: Client, tables: string[]) => {
  const result: Record<string, { count: number; hash: string }> = {};
  for (const table of tables) {
    const row = (
      await client.query(
        `SELECT count(*)::int count,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) hash FROM public.${quote(table)} t`,
      )
    ).rows[0];
    result[table] = row;
  }
  return result;
};

let stage = "preflight";
async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  const database = decodeURIComponent(target.pathname.slice(1));
  const local =
    ["localhost", "127.0.0.1"].includes(target.hostname) &&
    /^sb_reset_[a-f0-9]{10}$/.test(database);
  const remote =
    target.hostname.endsWith(".neon.tech") &&
    ["smartbarber-dev", "smartbarber-dev-2"].includes(database);
  if (database !== process.env.EXPECTED_DATABASE || (!local && !remote))
    throw Error("TARGET_GUARD");
  const mode = argument("mode");
  if (!["apply", "rollback-test", "inspect"].includes(mode ?? ""))
    throw Error("MODE_GUARD");
  if (mode === "rollback-test" && !local)
    throw Error("ROLLBACK_TEST_LOCAL_ONLY");
  if (mode === "apply" && argument("confirm") !== "ZERAR_E_RECRIAR_SEED")
    throw Error("CONFIRMATION_REQUIRED");
  const output = resolve(argument("output")!);
  if (!output.startsWith("D:\\Smart_Barber_Entregas\\seed-reset-20261103\\"))
    throw Error("PRIVATE_OUTPUT_REQUIRED");
  if (
    mode !== "inspect" &&
    existsSync(resolve(output, ".demo-seed-credentials.json"))
  )
    throw Error("FRESH_CREDENTIAL_DIRECTORY_REQUIRED");
  mkdirSync(output, { recursive: true });
  process.chdir(output);
  const { DemoSeedEngine } = await import(
    "../src/infra/drizzle/demo-seed/canonical/engine.js"
  );
  const schema = await import("../src/infra/drizzle/schema.js");
  const fixtures = await import(
    "../src/infra/drizzle/demo-seed/canonical/fixtures.js"
  );
  const { DEFAULT_DEMO_PASSWORD } = await import(
    "../src/infra/drizzle/demo-seed/canonical/security.js"
  );
  const { compare } = await import("bcryptjs");
  const allowed = new Set(
    Object.values(schema)
      .filter((value) => is(value, PgTable))
      .map((value) => getTableName(value as PgTable)),
  );
  allowed.add("demo_seed_registry");
  const client = new Client({
    host: target.hostname,
    port: Number(target.port || 5432),
    user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password),
    database,
    ssl: remote
      ? { rejectUnauthorized: true, ca: rootCertificates.join("\n") }
      : false,
    enableChannelBinding: remote,
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  try {
    await client.query("SET timezone='UTC'");
    const tables: string[] = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((row) => row.tablename);
    if (!tables.length || tables.some((table) => !allowed.has(table)))
      throw Error("UNKNOWN_TABLES_GUARD");
    for (const required of [
      "users",
      "barbershops",
      "services",
      "membership",
      "bookings",
      "demo_seed_registry",
      "refresh_tokens",
    ])
      if (!tables.includes(required)) throw Error("SCHEMA_INCOMPLETE");
    stage = "fingerprint-before";
    const before = await fingerprint(client, tables);
    if (mode === "inspect") {
      console.log(
        JSON.stringify({
          database,
          tables,
          counts: Object.fromEntries(
            Object.entries(before).map(([key, value]) => [key, value.count]),
          ),
          readOnly: true,
        }),
      );
      return;
    }
    let proof: any;
    if (remote) {
      proof = JSON.parse(
        readFileSync(resolve(argument("backup-proof")!), "utf8"),
      );
      if (
        proof.database !== database ||
        proof.host !== target.hostname ||
        !proof.fingerprints ||
        !proof.archiveVerified ||
        Date.now() - Date.parse(proof.timestamp) > 3600000
      )
        throw Error("RECENT_SNAPSHOT_BACKUP_REQUIRED");
      const backup = readFileSync(proof.backup);
      const { createHash } = await import("node:crypto");
      if (
        backup.subarray(0, 5).toString() !== "PGDMP" ||
        createHash("sha256").update(backup).digest("hex") !== proof.backupSha256
      )
        throw Error("BACKUP_INTEGRITY_GUARD");
    }
    const connection = drizzle({ client });
    const originalLog = console.log;
    let rolledBack = false;
    let summary: unknown;
    const expectedCounts: Record<string, number> = {
      demo_seed_registry:
        fixtures.DEMO_STAFFS.length +
        fixtures.DEMO_CUSTOMERS.length +
        fixtures.DEMO_BARBERSHOPS.length +
        fixtures.DEMO_SERVICES.length +
        fixtures.buildDemoMemberships().length +
        fixtures.buildDemoSchedules().length +
        fixtures.DEMO_EXCEPTIONS.length +
        fixtures.DEMO_BOOKINGS.length * 5,
      users: fixtures.DEMO_STAFFS.length + fixtures.DEMO_CUSTOMERS.length,
      barbershops: fixtures.DEMO_BARBERSHOPS.length,
      services: fixtures.DEMO_SERVICES.length,
      membership: fixtures.buildDemoMemberships().length,
      barbershop_schedules: fixtures.buildDemoSchedules().length,
      bookings: fixtures.DEMO_BOOKINGS.length,
      service_items: fixtures.DEMO_BOOKINGS.length,
      shopping_carts: fixtures.DEMO_BOOKINGS.length,
      schedule_exceptions: fixtures.DEMO_EXCEPTIONS.length,
      booking_events: fixtures.DEMO_BOOKINGS.length,
      booking_service_items: fixtures.DEMO_BOOKINGS.length,
    };
    try {
      stage = "transaction";
      await connection.transaction(async (transaction) => {
        await transaction.execute(
          sql.raw(
            "SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='180s';",
          ),
        );
        await transaction.execute(
          sql.raw("SELECT pg_advisory_xact_lock(87392013)"),
        );
        // All application tables are locked together. No CASCADE may escape the reviewed list.
        await transaction.execute(
          sql.raw(
            `LOCK TABLE ${tables.map((table) => "public." + quote(table)).join(",")} IN ACCESS EXCLUSIVE MODE`,
          ),
        );
        const locked = await fingerprint(client, tables);
        if (
          JSON.stringify(locked) !==
          JSON.stringify(remote ? proof.fingerprints : before)
        )
          throw Error("DATABASE_CHANGED_SINCE_BACKUP");
        await transaction.execute(
          sql.raw(
            `TRUNCATE TABLE ${tables.map((table) => "public." + quote(table)).join(",")} RESTART IDENTITY`,
          ),
        );
        stage = "seed";
        console.log = () => {};
        try {
          summary = await new DemoSeedEngine(transaction).run({
            dryRun: false,
            confirmSecret: "CONFIRMAR_SEED_DEMO_PRODUCAO",
          });
        } finally {
          console.log = originalLog;
        }
        stage = "counts";
        for (const table of tables) {
          const count = Number(
            (await client.query(`SELECT count(*) FROM public.${quote(table)}`))
              .rows[0].count,
          );
          if (count !== (expectedCounts[table] ?? 0))
            throw Error("FINAL_COUNTS_GUARD:" + table);
        }
        stage = "passwords";
        const rows = (await client.query("SELECT * FROM users")).rows;
        const credentials = JSON.parse(
          readFileSync(resolve(output, ".demo-seed-credentials.json"), "utf8"),
        );
        for (const fixture of [
          ...fixtures.DEMO_STAFFS,
          ...fixtures.DEMO_CUSTOMERS,
        ]) {
          const row = rows.find((row) => row.email === fixture.email);
          const staff = fixtures.DEMO_STAFFS.find(
            (staff) => staff.logicalKey === fixture.logicalKey,
          );
          const password = staff
            ? credentials[fixture.logicalKey]?.plainPassword
            : DEFAULT_DEMO_PASSWORD;
          if (
            !row ||
            row.name !== fixture.name ||
            row.cpf !== fixture.cpf ||
            !row.email_verified_at ||
            !password ||
            !(await compare(password, row.password))
          )
            throw Error("CREDENTIALS_OR_PROFILE_GUARD");
          if (
            row.account_type !==
            (staff ? (staff.role === "OWNER" ? "OWNER" : "BARBER") : "CLIENT")
          )
            throw Error("ACCOUNT_TYPE_GUARD");
        }
        stage = "shop-fixtures";
        const shops = (await client.query("SELECT * FROM barbershops")).rows;
        for (const fixture of fixtures.DEMO_BARBERSHOPS)
          if (
            !shops.some(
              (row) =>
                row.name === fixture.name &&
                row.slug === fixture.slug &&
                row.cnpj === fixture.cnpj &&
                row.status === fixture.status,
            )
          )
            throw Error("SHOP_FIXTURE_GUARD");
        stage = "service-fixtures";
        const services = (
          await client.query(
            "SELECT s.*,r.logical_key FROM services s JOIN demo_seed_registry r ON r.record_id=s.id AND r.table_name='services' WHERE r.namespace='demo-smart-barber-v1'",
          )
        ).rows;
        for (const fixture of fixtures.DEMO_SERVICES)
          if (
            !services.some(
              (row) =>
                row.logical_key === fixture.logicalKey &&
                row.title === fixture.title &&
                row.price_in_cents === fixture.priceInCents &&
                row.duration_in_minutes === fixture.durationInMinutes &&
                row.is_active === fixture.isActive,
            )
          )
            throw Error("SERVICE_FIXTURE_GUARD");
        if (mode === "rollback-test") throw Error("EXPECTED_LOCAL_ROLLBACK");
      });
    } catch (error) {
      if (
        mode === "rollback-test" &&
        error instanceof Error &&
        error.message === "EXPECTED_LOCAL_ROLLBACK"
      )
        rolledBack = true;
      else throw error;
    } finally {
      console.log = originalLog;
    }
    const after = await fingerprint(client, tables);
    if (
      mode === "rollback-test" &&
      JSON.stringify(before) !== JSON.stringify(after)
    )
      throw Error("ATOMIC_ROLLBACK_FAILED");
    const report = {
      database,
      mode,
      committed: mode === "apply",
      rollbackVerified: rolledBack,
      profilesAndPasswordsVerified: true,
      counts: Object.fromEntries(
        Object.entries(after).map(([key, value]) => [key, value.count]),
      ),
      seedSummary: summary,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(
      resolve(output, "result.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        database,
        committed: report.committed,
        rollbackVerified: rolledBack,
        profilesAndPasswordsVerified: true,
        counts: report.counts,
      }),
    );
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // Never emit provider SQL, connection strings, row parameters, passwords or credential files.
    const code =
      error instanceof Error && /^[A-Z_:a-z]+$/.test(error.message)
        ? error.message
        : "OPERATION_FAILED_NO_DETAILS";
    console.error(
      JSON.stringify({
        error: code,
        database: process.env.EXPECTED_DATABASE,
        stage,
        causeCode: error?.cause?.code,
        constraint: error?.cause?.constraint,
        stackLocations:
          error instanceof Error
            ? error.stack
                ?.split("\n")
                .filter((line) => line.trim().startsWith("at "))
                .slice(0, 4)
            : undefined,
        committed: false,
      }),
    );
    process.exit(1);
  });
