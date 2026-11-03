/**
 * Script idempotente para reconciliar localizações geográficas das barbearias demo.
 * Não altera usuários, senhas, agendamentos ou tabelas não-geográficas.
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { DEMO_BARBERSHOPS } from "../src/infra/drizzle/demo-seed/canonical/barbershop-fixtures";
import { reconcileDemoGeography } from "../src/infra/drizzle/demo-seed/geography";
import { DEMO_SEED_NAMESPACE } from "../src/infra/drizzle/demo-seed/canonical/types";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const target = new URL(databaseUrl);
  const database = decodeURIComponent(target.pathname.slice(1));

  process.env.DATABASE_URL = databaseUrl;
  process.env.PGHOST = target.hostname;
  process.env.PGPORT = target.port || "5432";
  process.env.PGUSER = decodeURIComponent(target.username);
  process.env.PGPASSWORD = decodeURIComponent(target.password);
  process.env.PGDATABASE = database;

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool);

  console.log("=== Reconciliação Idempotente de Localizações Demo ===");

  const summary: Record<string, any> = {
    processed: 0,
    created: 0,
    updated: 0,
    reused: 0,
    preserved: 0,
    blockedNoCoordinates: 0,
  };

  try {
    for (const fixture of DEMO_BARBERSHOPS) {
      if (!fixture.point) {
        console.log(`[BLOCKED] ${fixture.name} (${fixture.logicalKey}): sem coordenadas na fonte primária (regional-locations.ts). Nenhuma coordenada inventada.`);
        summary.blockedNoCoordinates++;
        continue;
      }

      // Localiza a barbearia no banco pelo slug e logicalKey no registro
      const shopResult = await pool.query(
        `SELECT b.id, b.owner_id, b.name, b.slug
         FROM barbershops b
         JOIN demo_seed_registry r ON r.record_id = b.id AND r.table_name = 'barbershops'
         WHERE r.namespace = $1 AND r.logical_key = $2
         LIMIT 1`,
        [DEMO_SEED_NAMESPACE, fixture.logicalKey]
      );

      if (shopResult.rows.length === 0) {
        console.warn(`[WARN] Barbearia demo não encontrada no registro: ${fixture.logicalKey}`);
        continue;
      }

      const shop = shopResult.rows[0];

      const res = await reconcileDemoGeography(
        db,
        shop.id,
        fixture,
        shop.owner_id
      );

      console.log(`[OK] ${fixture.name}: ação = ${res.action}, locationId = ${res.locationId}`);
      summary.processed++;
      summary[res.action] = (summary[res.action] ?? 0) + 1;
    }

    console.log("\n=== Resumo de Execução ===");
    console.table(summary);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falha na reconciliação:", err);
  process.exit(1);
});
