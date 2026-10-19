import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

export function validatePhase1TestUrl(value: string): URL {
  const target = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/sb_phase1_test_[a-z0-9_]+$/.test(target.pathname) ||
    target.search ||
    target.hash
  ) {
    throw new Error(
      "Phase 1 tests require a dedicated local sb_phase1_test_* database.",
    );
  }
  return target;
}

export async function createPhase1TestDatabase(value: string) {
  const target = validatePhase1TestUrl(value);
  const admin = new Pool({
    connectionString: value,
    connectionTimeoutMillis: 3000,
  });
  const database = `sb_phase1_test_${randomUUID().replaceAll("-", "")}`;
  const owned = new URL(target);
  owned.pathname = `/${database}`;
  let pool: Pool | undefined;
  let created = false;
  let closed = false;

  async function close() {
    if (closed) return;
    closed = true;
    try {
      await pool?.end();
    } finally {
      try {
        if (created && /^sb_phase1_test_[a-f0-9]{32}$/.test(database)) {
          await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
        }
      } finally {
        await admin.end();
      }
    }
  }

  try {
    const identity = await admin.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    if (identity.rows[0]?.database !== target.pathname.slice(1)) {
      throw new Error("Unexpected Phase 1 test database identity.");
    }
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const root = resolve(__dirname, "../..");
    try {
      await promisify(execFile)(
        process.execPath,
        [resolve(root, "node_modules/drizzle-kit/bin.cjs"), "push", "--force"],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: "test",
            DATABASE_URL: owned.toString(),
          },
          timeout: 30000,
          maxBuffer: 2 * 1024 * 1024,
        },
      );
    } catch {
      // CLI output can contain credentials; expose only the failed bootstrap stage.
      throw new Error("Could not initialize the disposable Phase 1 schema.");
    }
    pool = new Pool({
      connectionString: owned.toString(),
      options: "-c lock_timeout=3000 -c statement_timeout=10000",
    });
    return { db: drizzle({ client: pool }), pool, database, close };
  } catch (error) {
    await close();
    throw error;
  }
}
