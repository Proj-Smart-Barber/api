import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDiscoveryTestDatabase,
  type IsolatedDiscoveryDatabase,
} from "../../../test/helpers/isolated-discovery-db";
import { runSchemaMigrations } from "./migrator";

const testDbUrl = process.env.DISCOVERY_TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)(
  "Discovery Schema & Persistence (Integration)",
  () => {
    let isolated: IsolatedDiscoveryDatabase;

    beforeAll(async () => {
      if (!testDbUrl) {
        throw new Error("DISCOVERY_TEST_DATABASE_URL is required.");
      }
      isolated = await createDiscoveryTestDatabase(testDbUrl);
    });

    afterAll(async () => {
      if (isolated) {
        await isolated.close();
      }
    });

    it("applies schema migrations idempotently on the isolated schema", async () => {
      const firstRun = await runSchemaMigrations(isolated.db);
      expect(firstRun.success).toBe(true);

      const secondRun = await runSchemaMigrations(isolated.db);
      expect(secondRun.success).toBe(true);
    });

    it("supports two concurrent isolated schemas without constraint/type conflicts", async () => {
      const isolated2 = await createDiscoveryTestDatabase(testDbUrl!);
      try {
        const run1 = await runSchemaMigrations(isolated2.db);
        expect(run1.success).toBe(true);

        // Verify constraints exist in both schemas independently
        const checkSchemaConstraints = async (schema: string) => {
          const res = await isolated.pool.query(
            `
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class cl ON cl.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = cl.relnamespace
            WHERE n.nspname = $1
              AND c.conname = 'barbershop_locations_coordinates_check'
          `,
            [schema],
          );
          expect(res.rows).toHaveLength(1);
        };

        await checkSchemaConstraints(isolated.schema);
        await checkSchemaConstraints(isolated2.schema);

        // Verify idempotent rerun on both schemas
        const runIdempotent1 = await runSchemaMigrations(isolated.db);
        const runIdempotent2 = await runSchemaMigrations(isolated2.db);
        expect(runIdempotent1.success).toBe(true);
        expect(runIdempotent2.success).toBe(true);
      } finally {
        await isolated2.close();
      }
    });

    it("preserves legacy barbershops without location row as unconfirmed", async () => {
      await isolated.pool.query(`
      INSERT INTO users (id, name, email, password, cpf)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Owner 1', 'owner1@example.com', 'hash', '12345678901');

      INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
      VALUES ('22222222-2222-2222-2222-222222222222', 'Barbearia Vintage', '11111111-1111-1111-1111-111111111111', 'vintage-barber', '12345678000199', 'Rua das Flores, 123', 'ACTIVE');
    `);

      const result = await isolated.pool.query(`
      SELECT b.id, b.name, b.location, bl.status, bl.latitude, bl.longitude
      FROM barbershops b
      LEFT JOIN barbershop_locations bl ON bl.barbershop_id = b.id
      WHERE b.id = '22222222-2222-2222-2222-222222222222'
    `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBeNull(); // No location row = null status in join (domain treats as UNCONFIRMED)
      expect(result.rows[0].latitude).toBeNull();
      expect(result.rows[0].longitude).toBeNull();
    });

    it("accepts (0,0) as a valid coordinate pair", async () => {
      await isolated.pool.query(`
      INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, version)
      VALUES ('22222222-2222-2222-2222-222222222222', 'CONFIRMED', 0, 0, 1)
    `);

      const result = await isolated.pool.query(`
      SELECT status, latitude, longitude FROM barbershop_locations
      WHERE barbershop_id = '22222222-2222-2222-2222-222222222222'
    `);

      expect(result.rows[0].latitude).toBe(0);
      expect(result.rows[0].longitude).toBe(0);
      expect(result.rows[0].status).toBe("CONFIRMED");
    });

    it("rejects incomplete coordinate pairs via check constraint", async () => {
      await isolated.pool.query(`
      INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
      VALUES ('33333333-3333-3333-3333-333333333333', 'Barbearia Borda', '11111111-1111-1111-1111-111111111111', 'barbearia-borda', '99887766000155', 'Av Central, 50', 'ACTIVE');
    `);

      await expect(
        isolated.pool.query(`
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude)
        VALUES ('33333333-3333-3333-3333-333333333333', 'CONFIRMED', -23.55052, NULL)
      `),
      ).rejects.toThrow();

      await expect(
        isolated.pool.query(`
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude)
        VALUES ('33333333-3333-3333-3333-333333333333', 'CONFIRMED', NULL, -46.633308)
      `),
      ).rejects.toThrow();
    });

    it("rejects out-of-range coordinates via check constraint", async () => {
      await expect(
        isolated.pool.query(`
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude)
        VALUES ('33333333-3333-3333-3333-333333333333', 'CONFIRMED', 95.0, 0.0)
      `),
      ).rejects.toThrow();

      await expect(
        isolated.pool.query(`
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude)
        VALUES ('33333333-3333-3333-3333-333333333333', 'CONFIRMED', 0.0, 185.0)
      `),
      ).rejects.toThrow();
    });

    it("rejects negative version numbers via check constraint", async () => {
      await expect(
        isolated.pool.query(`
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, version)
        VALUES ('33333333-3333-3333-3333-333333333333', 'CONFIRMED', -23.5, -46.6, -1)
      `),
      ).rejects.toThrow();
    });

    it("persists geocoding_candidates without raw json or formatted_address", async () => {
      const candidateId = "44444444-4444-4444-4444-444444444444";
      await isolated.pool.query(`
      INSERT INTO geocoding_candidates (id, actor_id, barbershop_id, address_hash, latitude, longitude, place_id, expires_at)
      VALUES (
        '${candidateId}',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'sha256_mock_hash_address',
        -23.55052,
        -46.633308,
        'ChIJplaceholder',
        NOW() + INTERVAL '15 minutes'
      )
    `);

      // Verify columns of geocoding_candidates
      const columns = await isolated.pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = '${isolated.schema}' AND table_name = 'geocoding_candidates'
    `);
      const colNames = columns.rows.map(
        (r: { column_name: string }) => r.column_name,
      );

      expect(colNames).toContain("id");
      expect(colNames).toContain("actor_id");
      expect(colNames).toContain("address_hash");
      expect(colNames).toContain("latitude");
      expect(colNames).toContain("longitude");
      expect(colNames).toContain("place_id");
      expect(colNames).toContain("expires_at");
      expect(colNames).not.toContain("raw_json");
      expect(colNames).not.toContain("formatted_address");
      expect(colNames).not.toContain("display_address");
    });

    it("creates required indexes on barbershop_locations and geocoding_candidates", async () => {
      const indexes = await isolated.pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = '${isolated.schema}'
    `);
      const indexDefs = indexes.rows.map(
        (r: { indexname: string; indexdef: string }) => r.indexname,
      );

      expect(indexDefs).toContain(
        "barbershop_locations_status_valid_until_idx",
      );
      expect(indexDefs).toContain("barbershop_locations_valid_until_idx");
      expect(indexDefs).toContain("geocoding_candidates_actor_id_idx");
      expect(indexDefs).toContain("geocoding_candidates_expires_at_idx");
    });
  },
);
