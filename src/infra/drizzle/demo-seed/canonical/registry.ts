import { sql } from "drizzle-orm";
import { db } from "../../index";
import type { SeedDatabase } from "./database";
import type { SeedRegistryRecord } from "./types";

export class SeedRegistryManager {
  constructor(private database: SeedDatabase = db) {}
  async ensureRegistryTable(): Promise<void> {
    await this.database.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS demo_seed_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        namespace TEXT NOT NULL,
        logical_key TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT demo_seed_registry_namespace_logical_key_unique UNIQUE (namespace, logical_key)
      );
      CREATE INDEX IF NOT EXISTS demo_seed_registry_namespace_table_idx ON demo_seed_registry (namespace, table_name);
    `),
    );
  }

  async getExistingRecordsReadOnly(
    namespace: string,
  ): Promise<Map<string, SeedRegistryRecord> | null> {
    try {
      const checkTable = await this.database.execute(
        sql.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'demo_seed_registry'
        );
      `),
      );
      const exists = (checkTable.rows?.[0] as any)?.exists;
      if (!exists) {
        return null;
      }

      const result = await this.database.execute(
        sql.raw(`
        SELECT id, namespace, logical_key as "logicalKey", table_name as "tableName", record_id as "recordId", created_at as "createdAt"
        FROM demo_seed_registry
        WHERE namespace = '${namespace.replace(/'/g, "''")}'
      `),
      );

      const map = new Map<string, SeedRegistryRecord>();
      const rows = (result.rows || []) as unknown as SeedRegistryRecord[];

      for (const row of rows) {
        map.set(row.logicalKey, row);
      }

      return map;
    } catch {
      throw new Error(
        "Não foi possível consultar o registro do seed com segurança.",
      );
    }
  }

  async getExistingRecords(
    namespace: string,
  ): Promise<Map<string, SeedRegistryRecord>> {
    await this.ensureRegistryTable();

    const result = await this.database.execute(
      sql.raw(`
      SELECT id, namespace, logical_key as "logicalKey", table_name as "tableName", record_id as "recordId", created_at as "createdAt"
      FROM demo_seed_registry
      WHERE namespace = '${namespace.replace(/'/g, "''")}'
    `),
    );

    const map = new Map<string, SeedRegistryRecord>();
    const rows = (result.rows || []) as unknown as SeedRegistryRecord[];

    for (const row of rows) {
      map.set(row.logicalKey, row);
    }

    return map;
  }

  async recordEntry(
    namespace: string,
    logicalKey: string,
    tableName: string,
    recordId: string,
  ): Promise<void> {
    await this.database.execute(
      sql.raw(`
      INSERT INTO demo_seed_registry (namespace, logical_key, table_name, record_id)
      VALUES (
        '${namespace.replace(/'/g, "''")}',
        '${logicalKey.replace(/'/g, "''")}',
        '${tableName.replace(/'/g, "''")}',
        '${recordId.replace(/'/g, "''")}'
      )
      ON CONFLICT (namespace, logical_key) DO UPDATE
      SET record_id = EXCLUDED.record_id;
    `),
    );
  }

  async rollback(namespace: string): Promise<Record<string, number>> {
    await this.ensureRegistryTable();

    const existingMap = await this.getExistingRecords(namespace);
    const deletedCounts: Record<string, number> = {};

    if (existingMap.size === 0) {
      return deletedCounts;
    }

    // Ordem inversa estrita de dependências para não violar foreign keys
    const deletionOrder = [
      "notifications",
      "schedule_exceptions",
      "booking_events",
      "booking_service_items",
      "bookings",
      "shopping_carts",
      "service_items",
      "services",
      "barbershop_schedules",
      "membership",
      "barbershops",
      "customers",
      "staffs",
      "users",
    ];

    const recordsByTable: Record<string, string[]> = {};
    for (const record of existingMap.values()) {
      if (!recordsByTable[record.tableName]) {
        recordsByTable[record.tableName] = [];
      }
      recordsByTable[record.tableName].push(record.recordId);
    }

    for (const table of deletionOrder) {
      const ids = recordsByTable[table] || [];
      if (ids.length > 0) {
        const quotedIds = ids
          .map((id) => `'${id.replace(/'/g, "''")}'`)
          .join(", ");
        if (table === "barbershops") {
          try {
            await this.database.execute(
              sql.raw(`
              DELETE FROM barbershop_schedules
              WHERE barbershop_id IN (${quotedIds});
            `),
            );
          } catch {
            // Ignora se tabela não existir ou já limpa
          }
        }

        try {
          await this.database.execute(
            sql.raw(`
            DELETE FROM ${table}
            WHERE id IN (${quotedIds});
          `),
          );
          deletedCounts[table] = ids.length;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (
            (table === "staffs" || table === "customers") &&
            errMsg.includes("does not exist")
          ) {
            try {
              await this.database.execute(
                sql.raw(`
                DELETE FROM users
                WHERE id IN (${quotedIds});
              `),
              );
              deletedCounts.users = (deletedCounts.users || 0) + ids.length;
            } catch {
              // Ignora se já tiver sido deletado
            }
          } else {
            throw err;
          }
        }
      }
    }

    // Limpa a tabela de registry para este namespace
    await this.database.execute(
      sql.raw(`
      DELETE FROM demo_seed_registry
      WHERE namespace = '${namespace.replace(/'/g, "''")}';
    `),
    );

    deletedCounts.demo_seed_registry = existingMap.size;

    return deletedCounts;
  }
}
