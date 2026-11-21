import "dotenv/config";
import {
  createReadStream,
  openSync,
  readSync,
  closeSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { Client } from "pg";
import { inspectDatabaseTarget } from "../src/infra/drizzle/demo-seed/canonical/security";
import { standardizeDemoServicePrice } from "../src/infra/drizzle/demo-seed/canonical/full-profile-fixtures";
import { env } from "../src/infra/env";

const NAMESPACE = "demo-smart-barber-v1";
const TARGET_DATABASE = "smartbarber-dev-2";
const REQUIRED_CONFIRMATION = "APLICAR_AJUSTE_PRECOS_PRODUCAO";

type SeedService = { id: string; priceInCents: number };

async function verifyBackup(
  path: string,
  expectedSha256: string,
): Promise<void> {
  if (!isAbsolute(path)) throw new Error("Backup path must be absolute.");
  const absolutePath = resolve(path);
  const sourceRoot = resolve(__dirname, "..");
  const relativePath = relative(sourceRoot, absolutePath);
  if (
    relativePath === "" ||
    (!isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`))
  ) {
    throw new Error("Backup must be outside the source checkout.");
  }
  const stats = statSync(absolutePath);
  const ageMs = Date.now() - stats.mtimeMs;
  if (
    !stats.isFile() ||
    stats.size < 5 ||
    ageMs < 0 ||
    ageMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error(
      "Backup must be a custom-format dump created within 24 hours.",
    );
  }
  const header = Buffer.alloc(5);
  const descriptor = openSync(absolutePath, "r");
  try {
    readSync(descriptor, header, 0, 5, 0);
  } finally {
    closeSync(descriptor);
  }
  if (header.toString("ascii") !== "PGDMP") {
    throw new Error("Backup is not a PostgreSQL custom-format dump.");
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(absolutePath)) hash.update(chunk);
  if (hash.digest("hex").toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error("Backup SHA-256 mismatch.");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const value = (prefix: string) =>
    args.find((arg) => arg.startsWith(`${prefix}=`))?.slice(prefix.length + 1);

  const target = inspectDatabaseTarget(env.DATABASE_URL);
  if (!target.isLocal && target.database !== TARGET_DATABASE) {
    throw new Error(`Refusing unexpected database target: ${target.database}.`);
  }
  if (apply && !target.isLocal) {
    if (value("--confirm") !== REQUIRED_CONFIRMATION) {
      throw new Error(
        "Production apply needs --confirm=APLICAR_AJUSTE_PRECOS_PRODUCAO.",
      );
    }
    if (value("--confirm-target") !== TARGET_DATABASE) {
      throw new Error(
        "Production apply needs --confirm-target=smartbarber-dev-2.",
      );
    }
    const backupPath = value("--backup");
    const backupSha256 = value("--backup-sha256");
    if (!backupPath || !backupSha256) {
      throw new Error(
        "Production apply needs the fresh backup path and SHA-256.",
      );
    }
    await verifyBackup(backupPath, backupSha256);
  }

  const client = new Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
    application_name: "smartbarber-demo-service-price-normalizer",
  });

  await client.connect();
  try {
    const { rows: services } = await client.query<SeedService>(`
      SELECT s.id, s.price_in_cents AS "priceInCents"
      FROM services s
      JOIN demo_seed_registry r ON r.record_id = s.id
      WHERE r.namespace = '${NAMESPACE}' AND r.table_name = 'services'
      ORDER BY s.id
    `);
    const changes = services.flatMap((service) => {
      const next = standardizeDemoServicePrice(service.priceInCents);
      return next === service.priceInCents
        ? []
        : [{ id: service.id, oldPrice: service.priceInCents, newPrice: next }];
    });
    const beforeExternal = await client.query<{
      fingerprint: string;
      count: string;
    }>(`
      SELECT COUNT(*)::text AS count,
        MD5(COALESCE(STRING_AGG(s.id::text || ':' || s.price_in_cents::text, ',' ORDER BY s.id), '')) AS fingerprint
      FROM services s
      WHERE NOT EXISTS (
        SELECT 1 FROM demo_seed_registry r
        WHERE r.namespace = '${NAMESPACE}' AND r.table_name = 'services' AND r.record_id = s.id
      )
    `);

    if (!apply) {
      console.log(
        JSON.stringify(
          {
            database: target.database,
            seededServices: services.length,
            alreadyCompliant: services.length - changes.length,
            toUpdate: changes.length,
            priceRulesCents: [0, 90, 99],
            externalServicesPreserved: Number(beforeExternal.rows[0].count),
          },
          null,
          2,
        ),
      );
      return;
    }

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '60s'");
      for (let offset = 0; offset < changes.length; offset += 250) {
        const chunk = changes.slice(offset, offset + 250);
        const values: string[] = [];
        const parameters: Array<string | number> = [];
        for (const row of chunk) {
          const index = parameters.length;
          values.push(
            `($${index + 1}::uuid, $${index + 2}::int, $${index + 3}::int)`,
          );
          parameters.push(row.id, row.oldPrice, row.newPrice);
        }
        const namespaceParameter = parameters.length + 1;
        parameters.push(NAMESPACE);
        const result = await client.query(
          `UPDATE services s SET price_in_cents = v.new_price
           FROM (VALUES ${values.join(",")}) AS v(id, old_price, new_price)
           JOIN demo_seed_registry r ON r.record_id = v.id
             AND r.namespace = $${namespaceParameter} AND r.table_name = 'services'
           WHERE s.id = v.id AND s.price_in_cents = v.old_price`,
          parameters,
        );
        if (result.rowCount !== chunk.length) {
          throw new Error(
            `Concurrent price change detected in batch ${offset / 250 + 1}.`,
          );
        }
      }

      const invalid = await client.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM services s JOIN demo_seed_registry r ON r.record_id = s.id
        WHERE r.namespace = '${NAMESPACE}' AND r.table_name = 'services'
          AND s.price_in_cents % 100 NOT IN (0, 90, 99)
      `);
      const afterExternal = await client.query<{
        fingerprint: string;
        count: string;
      }>(`
        SELECT COUNT(*)::text AS count,
          MD5(COALESCE(STRING_AGG(s.id::text || ':' || s.price_in_cents::text, ',' ORDER BY s.id), '')) AS fingerprint
        FROM services s
        WHERE NOT EXISTS (
          SELECT 1 FROM demo_seed_registry r
          WHERE r.namespace = '${NAMESPACE}' AND r.table_name = 'services' AND r.record_id = s.id
        )
      `);
      if (
        Number(invalid.rows[0].count) !== 0 ||
        afterExternal.rows[0].fingerprint !==
          beforeExternal.rows[0].fingerprint ||
        afterExternal.rows[0].count !== beforeExternal.rows[0].count
      ) {
        throw new Error(
          "Post-update price or non-seed preservation check failed.",
        );
      }
      await client.query("COMMIT");
      console.log(
        JSON.stringify(
          {
            database: target.database,
            updatedServices: changes.length,
            remainingNonstandardSeedServices: 0,
            externalServicesPreserved: Number(afterExternal.rows[0].count),
            centsEndings: [0, 90, 99],
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
