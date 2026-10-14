import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { SearchBarbershopsUseCase } from "../src/domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import { runSchemaMigrations } from "../src/infra/drizzle/migrator";
import { DrizzleDiscoveryRepository } from "../src/infra/drizzle/repositories/drizzle-discovery-repository";
import {
  createDiscoveryTestDatabase,
  type IsolatedDiscoveryDatabase,
} from "./helpers/isolated-discovery-db";

const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../src/infra/drizzle/index", () => ({
  get db() {
    return fixture.db;
  },
}));

const testDbUrl = process.env.DISCOVERY_TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)(
  "Discovery Group 1 Independent Review Regressions & Contract Coverage",
  () => {
    let isolated: IsolatedDiscoveryDatabase;
    let repo: DrizzleDiscoveryRepository;
    const owner = "99000000-0000-0000-0000-000000000001";

    beforeAll(async () => {
      if (!testDbUrl) {
        throw new Error("DISCOVERY_TEST_DATABASE_URL is required.");
      }

      isolated = await createDiscoveryTestDatabase(testDbUrl);
      fixture.db = isolated.db;
      const migrationResult = await runSchemaMigrations(isolated.db);
      expect(migrationResult.success).toBe(true);

      repo = new DrizzleDiscoveryRepository(isolated.db);
      await isolated.pool.query(
        "INSERT INTO users (id, name, email, password, cpf) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
        [owner, "Audit", "audit@example.com", "fake", "00000000000"],
      );
    });

    afterAll(async () => {
      if (isolated) {
        await isolated.close();
      }
    });

    async function shop(
      suffix: number,
      name: string,
      lat: number | null,
      lon: number | null,
      options?: {
        source?: "MANUAL" | "GOOGLE";
        status?: "CONFIRMED" | "UNCONFIRMED" | "NEEDS_REVIEW";
        active?: boolean;
        valid_until_sql?: string;
        acquired_at_sql?: string;
        google_place_id?: string | null;
        google_reference?: string | null;
        location_text?: string;
      },
    ) {
      const id = `99000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
      const status = options?.active === false ? "INACTIVE" : "ACTIVE";
      const locStatus = options?.status ?? "CONFIRMED";
      const source = options?.source ?? "MANUAL";
      const validUntilSql =
        options?.valid_until_sql !== undefined
          ? options.valid_until_sql
          : "now() + interval '1 day'";
      const acquiredAtSql =
        options?.acquired_at_sql !== undefined
          ? options.acquired_at_sql
          : "now() - interval '1 day'";
      const placeId = options?.google_place_id ?? null;
      const ref = options?.google_reference ?? null;
      const locText = options?.location_text ?? "Praça da Sé, 100";

      await isolated.pool.query(
        "INSERT INTO barbershops(id, name, owner_id, slug, cnpj, location, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET name = $2, location = $6, status = $7",
        [
          id,
          name,
          owner,
          `audit-${suffix}`,
          `audit-cnpj-${suffix}`,
          locText,
          status,
        ],
      );

      await isolated.pool.query(
        `INSERT INTO barbershop_locations(barbershop_id, status, latitude, longitude, source, valid_until, acquired_at, google_place_id, google_reference, version)
       VALUES ($1, $2, $3, $4, $5, ${validUntilSql}, ${acquiredAtSql}, $6, $7, 1)
       ON CONFLICT (barbershop_id) DO UPDATE SET status = $2, latitude = $3, longitude = $4, source = $5, valid_until = ${validUntilSql}, acquired_at = ${acquiredAtSql}, google_place_id = $6, google_reference = $7`,
        [id, locStatus, lat, lon, source, placeId, ref],
      );

      return id;
    }

    // ============================================================
    // Seção 1: As 7 reproduções originais da revisão independente
    // ============================================================
    describe("Original 7 Review Findings", () => {
      it("health without a record must be unavailable", async () => {
        await isolated.pool.query("DELETE FROM location_maintenance_health");
        expect(await repo.isLocationServiceHealthy()).toBe(false);
      });

      it("health with a stale heartbeat must be unavailable", async () => {
        await isolated.pool.query(
          "INSERT INTO location_maintenance_health(component, is_healthy, last_heartbeat_at) VALUES ('google_maps_cache', true, now() - interval '40 hours') ON CONFLICT (component) DO UPDATE SET is_healthy = true, last_heartbeat_at = now() - interval '40 hours'",
        );
        expect(await repo.isLocationServiceHealthy()).toBe(false);
      });

      it("ALL must suppress coordinates when maintenance is unhealthy", async () => {
        const id = await shop(101, "Maintenance audit", 0, 0);
        await isolated.pool.query(
          "UPDATE location_maintenance_health SET is_healthy = false WHERE component = 'google_maps_cache'",
        );
        const useCase = new SearchBarbershopsUseCase(repo);
        const result = await useCase.execute({
          mode: "ALL",
          q: "Maintenance audit",
          page: 1,
          limit: 20,
        });
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          expect(
            result.value.items.find((item) => item.id === id)?.coordinates,
          ).toBeNull();
        }
      });

      it("text search must match accented name using an unaccented query", async () => {
        const id = await shop(102, "Barbearia São Bento", 0, 0);
        const result = await repo.search({
          mode: "ALL",
          q: "sao bento",
          page: 1,
          limit: 20,
        });
        expect(result.items.map((item) => item.id)).toContain(id);
      });

      it("nearby must include a shop at 9999m north within a 10km radius", async () => {
        await isolated.pool.query(
          "UPDATE location_maintenance_health SET is_healthy = true, last_heartbeat_at = now() WHERE component = 'google_maps_cache'",
        );
        const lat = ((9999 / 6371000) * 180) / Math.PI;
        const id = await shop(103, "North boundary audit", lat, 0);
        const result = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 10,
          q: "North boundary audit",
          page: 1,
          limit: 20,
        });
        expect(result.items.map((item) => item.id)).toContain(id);
      });

      it("nearby must include a shop across the antimeridian within 10km", async () => {
        const id = await shop(104, "Antimeridian audit", 0, -179.99);
        const result = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 179.99 },
          radiusKm: 10,
          q: "Antimeridian audit",
          page: 1,
          limit: 20,
        });
        expect(result.items.map((item) => item.id)).toContain(id);
      });

      it("GOOGLE points without validity must not be published", async () => {
        await isolated.pool.query(
          "UPDATE location_maintenance_health SET is_healthy = true, last_heartbeat_at = now() WHERE component = 'google_maps_cache'",
        );
        const id = await shop(105, "Google validity audit", 0, 0);
        await isolated.pool.query(
          "UPDATE barbershop_locations SET source = 'GOOGLE', valid_until = NULL, acquired_at = now() - interval '40 days' WHERE barbershop_id = $1",
          [id],
        );
        const result = await repo.search({
          mode: "ALL",
          q: "Google validity audit",
          page: 1,
          limit: 20,
        });
        expect(
          result.items.find((item) => item.id === id)?.coordinates,
        ).toBeNull();
      });
    });

    // ============================================================
    // Seção 2: Geometria, Bounding Box e Paginação Espacial
    // ============================================================
    describe("Geometry, Spatial Filtering & Pagination Contracts", () => {
      beforeAll(async () => {
        await isolated.pool.query(
          "UPDATE location_maintenance_health SET is_healthy = true, last_heartbeat_at = now() WHERE component = 'google_maps_cache'",
        );
      });

      it("strictly includes point at exact 10,000m radius and excludes point at 10,010m", async () => {
        // Point exactly on the 10,000m perimeter (0.0899321742 deg north)
        const exactLat = ((10000 / 6371000) * 180) / Math.PI;
        const exactId = await shop(201, "Exact 10km Border Shop", exactLat, 0);

        // Point immediately outside: 10,010m (0.09002208 deg north, +10m beyond boundary)
        const outsideLat = ((10010 / 6371000) * 180) / Math.PI;
        const outsideId = await shop(
          202,
          "Outside 10km Border Shop",
          outsideLat,
          0,
        );

        const result = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 10,
          page: 1,
          limit: 20,
        });

        const foundIds = result.items.map((i) => i.id);
        expect(foundIds).toContain(exactId);
        expect(foundIds).not.toContain(outsideId);

        const exactItem = result.items.find((i) => i.id === exactId);
        expect(exactItem?.distanceMeters).toBeLessThanOrEqual(10000.0);
      });

      it("supports all four fixed radii: 5, 10, 25 and 50 km correctly", async () => {
        // Unit at 4km north
        const lat4k = ((4000 / 6371000) * 180) / Math.PI;
        const id4k = await shop(203, "Shop 4km", lat4k, 0);

        // Unit at 8km north
        const lat8k = ((8000 / 6371000) * 180) / Math.PI;
        const id8k = await shop(204, "Shop 8km", lat8k, 0);

        // Unit at 22km north
        const lat22k = ((22000 / 6371000) * 180) / Math.PI;
        const id22k = await shop(205, "Shop 22km", lat22k, 0);

        // Unit at 45km north
        const lat45k = ((45000 / 6371000) * 180) / Math.PI;
        const id45k = await shop(206, "Shop 45km", lat45k, 0);

        // Unit at 60km north
        const lat60k = ((60000 / 6371000) * 180) / Math.PI;
        const fiftyInput = {
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 50,
          page: 1,
          limit: 20,
        } as const;
        const beforeOutsideShop = await repo.search(fiftyInput);
        const id60k = await shop(207, "Shop 60km", lat60k, 0);

        // 1. Radius 5km: includes 4km, excludes 8km+
        const res5 = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 5,
          page: 1,
          limit: 20,
        });
        const ids5 = res5.items.map((i) => i.id);
        expect(ids5).toContain(id4k);
        expect(ids5).not.toContain(id8k);

        // 2. Radius 10km: includes 4km and 8km, excludes 22km+
        const res10 = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 10,
          page: 1,
          limit: 20,
        });
        const ids10 = res10.items.map((i) => i.id);
        expect(ids10).toContain(id4k);
        expect(ids10).toContain(id8k);
        expect(ids10).not.toContain(id22k);

        // 3. Radius 25km: includes 4km, 8km, 22km, excludes 45km+
        const res25 = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 25,
          page: 1,
          limit: 20,
        });
        const ids25 = res25.items.map((i) => i.id);
        expect(ids25).toContain(id22k);
        expect(ids25).not.toContain(id45k);

        // 4. Radius 50km: includes 4km, 8km, 22km, 45km, excludes 60km
        const res50 = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 50,
          page: 1,
          limit: 20,
        });
        const ids50 = res50.items.map((i) => i.id);
        expect(ids50).toContain(id45k);
        expect(ids50).not.toContain(id60k);
        expect(res50.total).toBe(beforeOutsideShop.total);
        expect(res50.hasNext).toBe(beforeOutsideShop.hasNext);
      });

      it("handles antimeridian crossing in the reverse direction (west to east)", async () => {
        // Origin at -179.99 deg longitude, shop at +179.99 deg longitude (~2.224km distance)
        const id = await shop(208, "Antimeridian West-East Shop", 0, 179.99);
        const result = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: -179.99 },
          radiusKm: 10,
          page: 1,
          limit: 20,
        });
        expect(result.items.map((i) => i.id)).toContain(id);
      });

      it("handles queries near the North Pole and South Pole without trigonometric singularities", async () => {
        // North Pole center (90.0, 0.0), shop at (89.95, 45.0) -> ~5.56km away
        const northShopId = await shop(209, "North Pole Shop", 89.95, 45.0);
        const northRes = await repo.search({
          mode: "NEARBY",
          point: { latitude: 90.0, longitude: 0.0 },
          radiusKm: 10,
          page: 1,
          limit: 20,
        });
        expect(northRes.items.map((i) => i.id)).toContain(northShopId);

        // South Pole center (-90.0, 0.0), shop at (-89.95, -45.0) -> ~5.56km away
        const southShopId = await shop(210, "South Pole Shop", -89.95, -45.0);
        const southRes = await repo.search({
          mode: "NEARBY",
          point: { latitude: -90.0, longitude: 0.0 },
          radiusKm: 10,
          page: 1,
          limit: 20,
        });
        expect(southRes.items.map((i) => i.id)).toContain(southShopId);
      });

      it("applies deterministic tie-breaking by id ASC when distances are identical", async () => {
        // Two shops equidistant from (0,0): one 1km north, one 1km south
        const delta = ((1000 / 6371000) * 180) / Math.PI;
        const idAlpha = await shop(211, "Tie Shop Alpha", delta, 0);
        const idBeta = await shop(212, "Tie Shop Beta", -delta, 0);

        const result = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 5,
          page: 1,
          limit: 20,
        });

        const alphaItem = result.items.find((i) => i.id === idAlpha);
        const betaItem = result.items.find((i) => i.id === idBeta);
        expect(alphaItem).toBeDefined();
        expect(betaItem).toBeDefined();
        // Since both have distance ~1000m, they must appear in order of id ASC
        const alphaIdx = result.items.findIndex((i) => i.id === idAlpha);
        const betaIdx = result.items.findIndex((i) => i.id === idBeta);
        if (idAlpha < idBeta) {
          expect(alphaIdx).toBeLessThan(betaIdx);
        } else {
          expect(betaIdx).toBeLessThan(alphaIdx);
        }
      });

      it("excludes distant points before LIMIT and preserves accurate total count and hasNext", async () => {
        // Register multiple distant shops (e.g. at 70km)
        const lat70k = ((70000 / 6371000) * 180) / Math.PI;
        await shop(213, "Far Shop 1", lat70k, 0);
        await shop(214, "Far Shop 2", lat70k, 0);

        const result = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 5,
          page: 1,
          limit: 10,
        });

        const itemIds = result.items.map((i) => i.id);
        expect(itemIds).not.toContain("99000000-0000-0000-0000-000000000213");
        expect(itemIds).not.toContain("99000000-0000-0000-0000-000000000214");
        expect(result.total).toBe(result.items.length);
        expect(result.hasNext).toBe(false);
      });
    });

    // ============================================================
    // Seção 3: Saúde, Manutenção e Elegibilidade Google / Manual
    // ============================================================
    describe("Maintenance Health & Source Eligibility Contracts", () => {
      it("accepts exactly 36 hours and rejects one microsecond beyond, using a stable database clock", async () => {
        const client = await isolated.pool.connect();
        try {
          await client.query("BEGIN");
          const boundaryRepo = new DrizzleDiscoveryRepository(
            drizzle({ client }),
          );
          for (const [microseconds, healthy] of [
            [1, true],
            [0, true],
            [-1, false],
          ] as const) {
            await client.query(
              `
              UPDATE location_maintenance_health
              SET is_healthy = true,
                last_heartbeat_at = NOW() - INTERVAL '36 hours' + ($1::integer * INTERVAL '1 microsecond')
              WHERE component = 'google_maps_cache'
            `,
              [microseconds],
            );
            expect(await boundaryRepo.isLocationServiceHealthy()).toBe(healthy);
          }
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
      });

      it("fails closed (returns false) if location_maintenance_health query encounters an error", async () => {
        const executeSpy = vi
          .spyOn(isolated.db, "execute")
          .mockRejectedValueOnce(new Error("Simulated connection timeout"));
        expect(await repo.isLocationServiceHealthy()).toBe(false);
        executeSpy.mockRestore();
      });

      it("NEARBY returns 503 while ALL succeeds with coordinates=null during health failure", async () => {
        await isolated.pool.query(`
          UPDATE location_maintenance_health
          SET is_healthy = false, last_heartbeat_at = now()
          WHERE component = 'google_maps_cache'
        `);

        const useCase = new SearchBarbershopsUseCase(repo);

        // NEARBY must fail with LocationServiceUnavailableError (HTTP 503)
        const nearbyRes = await useCase.execute({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 10,
          page: 1,
          limit: 10,
        });
        expect(nearbyRes.isLeft()).toBe(true);

        // ALL must succeed (HTTP 200) with shop data present, but coordinates stripped
        const allRes = await useCase.execute({
          mode: "ALL",
          page: 1,
          limit: 10,
        });
        expect(allRes.isRight()).toBe(true);
        if (allRes.isRight()) {
          expect(allRes.value.items.length).toBeGreaterThan(0);
          for (const item of allRes.value.items) {
            expect(item.coordinates).toBeNull();
          }
        }

        // Restore health
        await isolated.pool.query(`
          UPDATE location_maintenance_health
          SET is_healthy = true, last_heartbeat_at = now()
          WHERE component = 'google_maps_cache'
        `);
      });

      it("enforces Google 25-day validity ceiling and suppresses coordinates on invalid metadata", async () => {
        // 1. Valid Google point (acquired 5 days ago, valid until 15 days ahead <= 25 days)
        const validGoogleId = await shop(301, "Valid Google Shop", 0, 0, {
          source: "GOOGLE",
          acquired_at_sql: "now() - interval '5 days'",
          valid_until_sql: "now() + interval '15 days'",
          google_place_id: "ChIJ_valid_google_1",
        });

        // 2. Google point with missing acquired_at
        const nullAcquiredId = await shop(302, "Google Null Acquired", 0, 0, {
          source: "GOOGLE",
          acquired_at_sql: "NULL",
          valid_until_sql: "now() + interval '10 days'",
          google_place_id: "ChIJ_null_acquired",
        });

        // 3. Google point with future acquired_at (incoherent)
        const futureAcquiredId = await shop(
          303,
          "Google Future Acquired",
          0,
          0,
          {
            source: "GOOGLE",
            acquired_at_sql: "now() + interval '2 hours'",
            valid_until_sql: "now() + interval '10 days'",
            google_place_id: "ChIJ_future_acq",
          },
        );

        // 4. Google point exceeding 25-day ceiling (valid_until 28 days after acquired_at)
        const excessValidityId = await shop(
          304,
          "Google Excess Validity",
          0,
          0,
          {
            source: "GOOGLE",
            acquired_at_sql: "now() - interval '2 days'",
            valid_until_sql: "now() + interval '27 days'", // 29 days total > 25 days
            google_place_id: "ChIJ_excess_validity",
          },
        );

        // 5. MANUAL source but with google_place_id populated without meeting Google criteria
        const manualWithGoogleId = await shop(
          305,
          "Manual With Google PlaceId",
          0,
          0,
          {
            source: "MANUAL",
            google_place_id: "ChIJ_tampered_metadata",
            valid_until_sql: "NULL",
          },
        );

        // 6. Legitimate MANUAL point with valid_until = NULL
        const legitimateManualId = await shop(
          306,
          "Legitimate Manual Shop",
          0,
          0,
          {
            source: "MANUAL",
            valid_until_sql: "NULL",
          },
        );

        const result = await repo.search({
          mode: "ALL",
          page: 1,
          limit: 50,
        });

        const validGoogle = result.items.find((i) => i.id === validGoogleId);
        expect(validGoogle?.coordinates).not.toBeNull();

        const nullAcq = result.items.find((i) => i.id === nullAcquiredId);
        expect(nullAcq?.coordinates).toBeNull();

        const futureAcq = result.items.find((i) => i.id === futureAcquiredId);
        expect(futureAcq?.coordinates).toBeNull();

        const excessVal = result.items.find((i) => i.id === excessValidityId);
        expect(excessVal?.coordinates).toBeNull();

        const manualGoogle = result.items.find(
          (i) => i.id === manualWithGoogleId,
        );
        expect(manualGoogle?.coordinates).toBeNull();

        const legitimateManual = result.items.find(
          (i) => i.id === legitimateManualId,
        );
        expect(legitimateManual?.coordinates).not.toBeNull();
      });

      it("never publishes INACTIVE barbershops in either ALL or NEARBY mode", async () => {
        const inactiveId = await shop(307, "Inactive Shop", 0, 0, {
          active: false,
        });

        const allRes = await repo.search({
          mode: "ALL",
          q: "Inactive Shop",
          page: 1,
          limit: 20,
        });
        expect(allRes.items.map((i) => i.id)).not.toContain(inactiveId);

        const nearbyRes = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 10,
          q: "Inactive Shop",
          page: 1,
          limit: 20,
        });
        expect(nearbyRes.items.map((i) => i.id)).not.toContain(inactiveId);
      });

      it("handles UNCONFIRMED or NEEDS_REVIEW shops: in ALL with coordinates=null, excluded from NEARBY", async () => {
        const unconfirmedId = await shop(308, "Unconfirmed Shop", 0, 0, {
          status: "UNCONFIRMED",
        });
        const needsReviewId = await shop(309, "Needs Review Shop", 0, 0, {
          status: "NEEDS_REVIEW",
        });

        const allRes = await repo.search({
          mode: "ALL",
          page: 1,
          limit: 50,
        });
        const unconfirmedItem = allRes.items.find(
          (i) => i.id === unconfirmedId,
        );
        expect(unconfirmedItem?.coordinates).toBeNull();
        const needsReviewItem = allRes.items.find(
          (i) => i.id === needsReviewId,
        );
        expect(needsReviewItem?.coordinates).toBeNull();

        const nearbyRes = await repo.search({
          mode: "NEARBY",
          point: { latitude: 0, longitude: 0 },
          radiusKm: 10,
          page: 1,
          limit: 50,
        });
        expect(nearbyRes.items.map((i) => i.id)).not.toContain(unconfirmedId);
        expect(nearbyRes.items.map((i) => i.id)).not.toContain(needsReviewId);
      });
    });

    // ============================================================
    // Seção 4: Texto, Normalização e Paginação Dinâmica
    // ============================================================
    describe("Text Search, Unicode Normalization & Dynamic Pagination", () => {
      it("matches Portuguese diacritics in name and address with NFC and NFD queries", async () => {
        const id = await shop(401, "Barbearia Sé Clássica", 0, 0, {
          location_text: "Avenida São João, 500 - Sé, São Paulo",
        });

        // 1. Matches unaccented query against accented name
        const res1 = await repo.search({
          mode: "ALL",
          q: "se classica",
          page: 1,
          limit: 10,
        });
        expect(res1.items.map((i) => i.id)).toContain(id);

        // 2. Matches unaccented query against accented address
        const res2 = await repo.search({
          mode: "ALL",
          q: "sao joao",
          page: 1,
          limit: 10,
        });
        expect(res2.items.map((i) => i.id)).toContain(id);

        // 3. Matches Unicode NFD decomposed query
        const nfdQuery = "Sé".normalize("NFD");
        const res3 = await repo.search({
          mode: "ALL",
          q: nfdQuery,
          page: 1,
          limit: 10,
        });
        expect(res3.items.map((i) => i.id)).toContain(id);

        // 4. Matches with leading and trailing whitespace
        const res4 = await repo.search({
          mode: "ALL",
          q: "   clássica   ",
          page: 1,
          limit: 10,
        });
        expect(res4.items.map((i) => i.id)).toContain(id);
      });

      it("sorts by normalized name ASC and breaks ties by id ASC", async () => {
        const id1 = await shop(402, "Barbearia Águia Dourada", 0, 0);
        const id2 = await shop(403, "Barbearia Aguia Dourada", 0, 0);

        const res = await repo.search({
          mode: "ALL",
          q: "Aguia Dourada",
          page: 1,
          limit: 10,
        });

        expect(res.items.map((i) => i.id)).toEqual([id1, id2].sort());
      });

      it("demonstrates best-effort pagination when new shops are inserted between page queries", async () => {
        // Query Page 1 with limit 2
        const page1 = await repo.search({
          mode: "ALL",
          page: 1,
          limit: 2,
        });
        expect(page1.items).toHaveLength(2);
        expect(page1.hasNext).toBe(true);

        // Insert an additional shop
        await shop(404, "Brand New Shop Inter-Page", 0, 0);

        // Query Page 2 with limit 2
        const page2 = await repo.search({
          mode: "ALL",
          page: 2,
          limit: 2,
        });

        // total count reflects current database count dynamically
        expect(page2.total).toBeGreaterThan(page1.total);
        expect(page2.items).toBeDefined();
      });
    });
  },
);
