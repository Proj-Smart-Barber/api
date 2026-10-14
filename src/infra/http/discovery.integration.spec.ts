import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createDiscoveryTestDatabase,
  type IsolatedDiscoveryDatabase,
} from "../../../test/helpers/isolated-discovery-db";
import { runSchemaMigrations } from "../drizzle/migrator";
import { DrizzleDiscoveryRepository } from "../drizzle/repositories/drizzle-discovery-repository";

const fixture = vi.hoisted(() => ({
  db: null as unknown,
}));

vi.mock("../drizzle/index", () => ({
  get db() {
    return fixture.db;
  },
}));

import app from "../../app";

const testDbUrl = process.env.DISCOVERY_TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)(
  "Discovery API - Real HTTP & PostgreSQL Integration",
  () => {
    let isolated: IsolatedDiscoveryDatabase;
    let server: Server;
    let base: string;

    const ownerId = "10000000-0000-0000-0000-000000000001";
    // Base reference: Praça da Sé, São Paulo (-23.55052, -46.633308)
    const refLat = -23.55052;
    const refLon = -46.633308;

    const shopSeId = "20000000-0000-0000-0000-000000000001";
    const shopPaulistaId = "20000000-0000-0000-0000-000000000002";
    const shopSantanaId = "20000000-0000-0000-0000-000000000003";
    const shopSantoAmaroId = "20000000-0000-0000-0000-000000000004";
    const shopCampinasId = "20000000-0000-0000-0000-000000000005";
    const shopStaleId = "20000000-0000-0000-0000-000000000006";
    const shopUnconfirmedId = "20000000-0000-0000-0000-000000000007";
    const shopSpecialCharId = "20000000-0000-0000-0000-000000000008";

    beforeAll(async () => {
      if (!testDbUrl) {
        throw new Error("DISCOVERY_TEST_DATABASE_URL is required.");
      }

      isolated = await createDiscoveryTestDatabase(testDbUrl);
      fixture.db = isolated.db;

      await runSchemaMigrations(isolated.db);

      // Seed initial base data for integration tests
      await isolated.pool.query(`
        INSERT INTO users (id, name, email, password, cpf)
        VALUES ('${ownerId}', 'Discovery Owner', 'owner.discovery@example.com', 'hashed-pwd', '00011122233');

        -- Seed initial maintenance health: healthy with recent heartbeat
        INSERT INTO location_maintenance_health (component, is_healthy, last_heartbeat_at, details)
        VALUES ('google_maps_cache', true, now(), 'Initial test health')
        ON CONFLICT (component) DO UPDATE
        SET is_healthy = true, last_heartbeat_at = now(), details = 'Initial test health';

        -- 1. Sé (distância ~0 km, origem MANUAL sem expiração Google)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopSeId}', 'Barbearia Sé Central', '${ownerId}', 'se-central', '11111111000101', 'Praça da Sé, 1 - Centro, SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, valid_until, version)
        VALUES ('${shopSeId}', 'CONFIRMED', ${refLat}, ${refLon}, 'MANUAL', now() + interval '20 days', 1);

        -- 2. Paulista (~2.6 km, origem GOOGLE com aquisição recente há 2 dias e validade no dia 15)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopPaulistaId}', 'Barbearia Paulista Jardins', '${ownerId}', 'paulista-jardins', '11111111000102', 'Avenida Paulista, 1000 - Bela Vista, SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, acquired_at, valid_until, version)
        VALUES ('${shopPaulistaId}', 'CONFIRMED', -23.5615, -46.6560, 'GOOGLE', now() - interval '2 days', now() + interval '15 days', 1);

        -- 3. Santana (~5.6 km, origem GOOGLE)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopSantanaId}', 'Barbearia Santana Zona Norte', '${ownerId}', 'santana-zn', '11111111000103', 'Rua Voluntários da Pátria, 500 - Santana, SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, acquired_at, valid_until, version)
        VALUES ('${shopSantanaId}', 'CONFIRMED', -23.5000, -46.6300, 'GOOGLE', now() - interval '1 day', now() + interval '18 days', 1);

        -- 4. Santo Amaro (~13.1 km, origem GOOGLE)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopSantoAmaroId}', 'Barbearia Santo Amaro Sul', '${ownerId}', 'santo-amaro-sul', '11111111000104', 'Avenida Adolfo Pinheiro, 200 - Santo Amaro, SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, acquired_at, valid_until, version)
        VALUES ('${shopSantoAmaroId}', 'CONFIRMED', -23.6500, -46.7000, 'GOOGLE', now() - interval '5 days', now() + interval '10 days', 1);

        -- 5. Campinas (~80 km, origem GOOGLE)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopCampinasId}', 'Barbearia Campinas Centro', '${ownerId}', 'campinas-centro', '11111111000105', 'Rua Barão de Jaguara, 100 - Campinas, SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, acquired_at, valid_until, version)
        VALUES ('${shopCampinasId}', 'CONFIRMED', -22.9056, -47.0608, 'GOOGLE', now() - interval '2 days', now() + interval '15 days', 1);

        -- 6. Vencida (~100m, adquirida há 28 dias e vencida há 5 dias)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopStaleId}', 'Barbearia Vencida Ponto', '${ownerId}', 'vencida-ponto', '11111111000106', 'Rua Direita, 50 - Centro, SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, acquired_at, valid_until, version)
        VALUES ('${shopStaleId}', 'CONFIRMED', -23.5510, -46.6340, 'GOOGLE', now() - interval '28 days', now() - interval '5 days', 1);

        -- 7. Não confirmada (sem coordenadas)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopUnconfirmedId}', 'Barbearia Sem Ponto', '${ownerId}', 'sem-ponto', '11111111000107', 'Rua Sem Saída, 0 - SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, version)
        VALUES ('${shopUnconfirmedId}', 'UNCONFIRMED', NULL, NULL, 1);

        -- 8. Caracteres especiais (% e _)
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ('${shopSpecialCharId}', 'Corte 100% Estilo_Vip & Cia', '${ownerId}', 'corte-100-vip', '11111111000108', 'Rua 50%_Desconto, 77 - SP', 'ACTIVE');
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, valid_until, version)
        VALUES ('${shopSpecialCharId}', 'CONFIRMED', -23.5520, -46.6350, 'MANUAL', now() + interval '20 days', 1);
      `);

      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Missing test HTTP address");
      }
      base = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
      if (isolated) {
        await isolated.close();
      }
    });

    // Helper functions for HTTP calls
    function get(path: string) {
      return fetch(`${base}/api${path}`, {
        method: "GET",
      });
    }

    function post(path: string, body: unknown) {
      return fetch(`${base}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    // ==========================================
    // 1. GET /api/barbershops (Modo ALL)
    // ==========================================
    describe("GET /api/barbershops", () => {
      it("lists active barbershops ordered alphabetically by name", async () => {
        const response = await get("/barbershops");
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.page).toBe(1);
        expect(body.limit).toBe(20);
        expect(body.total).toBeGreaterThanOrEqual(8);
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.serverTime).toBeDefined();

        // Check alphabetical sorting
        const names = body.items.map((item: any) => item.name);
        const sortedNames = [...names].sort((a, b) =>
          a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
        );
        expect(names).toEqual(sortedNames);

        // Verify item projection
        const item = body.items[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("slug");
        expect(item).toHaveProperty("location");
        expect(item.distanceMeters).toBeNull();
        expect(item).toHaveProperty("coordinates");
      });

      it("filters shops by text query insensitive to case", async () => {
        const response = await get("/barbershops?q=paulista");
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe(shopPaulistaId);
      });

      it("escapes special characters (%, _, \\) literally in text query", async () => {
        // Querying "100%" should match "Corte 100% Estilo_Vip & Cia" literally
        const response1 = await get("/barbershops?q=100%25");
        expect(response1.status).toBe(200);
        const body1 = (await response1.json()) as any;
        expect(body1.items).toHaveLength(1);
        expect(body1.items[0].id).toBe(shopSpecialCharId);

        // Querying "Estilo_" should match literally
        const response2 = await get("/barbershops?q=Estilo_");
        expect(response2.status).toBe(200);
        const body2 = (await response2.json()) as any;
        expect(body2.items).toHaveLength(1);
        expect(body2.items[0].id).toBe(shopSpecialCharId);
      });

      it("rejects coordinates on GET with 400 Bad Request", async () => {
        const response = await get(
          `/barbershops?latitude=${refLat}&longitude=${refLon}`,
        );
        expect(response.status).toBe(400);

        const body = (await response.json()) as any;
        expect(body.error).toContain("Coordenadas não são permitidas");
      });

      it("rejects radiusKm on GET with 400 Bad Request", async () => {
        const response = await get("/barbershops?radiusKm=10");
        expect(response.status).toBe(400);

        const body = (await response.json()) as any;
        expect(body.error).toContain("Raio não é permitido");
      });

      it("respects pagination parameters and validates limits", async () => {
        const response = await get("/barbershops?page=1&limit=2");
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.items).toHaveLength(2);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(2);
        expect(body.hasNext).toBe(true);

        // Limit > 50 must be rejected
        const responseInvalid = await get("/barbershops?limit=51");
        expect(responseInvalid.status).toBe(400);
      });

      it("includes unconfirmed and stale shops in GET list with coordinates = null", async () => {
        const response = await get("/barbershops");
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        const unconfirmed = body.items.find(
          (item: any) => item.id === shopUnconfirmedId,
        );
        const stale = body.items.find((item: any) => item.id === shopStaleId);
        const se = body.items.find((item: any) => item.id === shopSeId);

        expect(unconfirmed).toBeDefined();
        expect(unconfirmed.coordinates).toBeNull();

        expect(stale).toBeDefined();
        expect(stale.coordinates).toBeNull();

        expect(se).toBeDefined();
        expect(se.coordinates).toEqual({
          latitude: refLat,
          longitude: refLon,
        });
      });
    });

    // ==========================================
    // 2. POST /api/barbershops/nearby (Modo NEARBY)
    // ==========================================
    describe("POST /api/barbershops/nearby", () => {
      it("validates mandatory fields and returns 400 when missing", async () => {
        const res1 = await post("/barbershops/nearby", {
          longitude: refLon,
          radiusKm: 10,
        });
        expect(res1.status).toBe(400);

        const res2 = await post("/barbershops/nearby", {
          latitude: refLat,
          radiusKm: 10,
        });
        expect(res2.status).toBe(400);

        const res3 = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
        });
        expect(res3.status).toBe(400);
      });

      it("rejects non-allowed radiusKm values with 400", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 15, // Only 5, 10, 25, 50 allowed
        });
        expect(response.status).toBe(400);
      });

      it("rejects invalid coordinate bounds with 400", async () => {
        const resLat = await post("/barbershops/nearby", {
          latitude: 91,
          longitude: 0,
          radiusKm: 5,
        });
        expect(resLat.status).toBe(400);

        const resLon = await post("/barbershops/nearby", {
          latitude: 0,
          longitude: 181,
          radiusKm: 5,
        });
        expect(resLon.status).toBe(400);
      });

      it("returns Cache-Control: no-store header for nearby discovery", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toContain("no-store");
      });

      it("filters by radius 5 km and sorts strictly by distance ASC", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 5,
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.page).toBe(1);
        expect(body.limit).toBe(20);
        expect(body.items.length).toBeGreaterThan(0);

        // Within 5km from Sé: Sé (~0m), SpecialChar (~200m), Paulista (~2.6km).
        // Santana (~5.6km) must NOT be present.
        const itemIds = body.items.map((i: any) => i.id);
        expect(itemIds).toContain(shopSeId);
        expect(itemIds).toContain(shopSpecialCharId);
        expect(itemIds).toContain(shopPaulistaId);
        expect(itemIds).not.toContain(shopSantanaId);
        expect(itemIds).not.toContain(shopSantoAmaroId);
        expect(itemIds).not.toContain(shopCampinasId);

        // Verify distance ascending order
        for (let i = 0; i < body.items.length - 1; i++) {
          expect(body.items[i].distanceMeters).toBeLessThanOrEqual(
            body.items[i + 1].distanceMeters,
          );
        }

        // Sé distance should be 0 or close to 0 (< 10 meters)
        const se = body.items.find((i: any) => i.id === shopSeId);
        expect(se.distanceMeters).toBeLessThan(10);
      });

      it("filters by radius 10 km (includes Santana, excludes Santo Amaro)", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        const itemIds = body.items.map((i: any) => i.id);
        expect(itemIds).toContain(shopSantanaId);
        expect(itemIds).not.toContain(shopSantoAmaroId); // ~13.1km
      });

      it("filters by radius 25 km (includes Santo Amaro, excludes Campinas)", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 25,
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        const itemIds = body.items.map((i: any) => i.id);
        expect(itemIds).toContain(shopSantoAmaroId);
        expect(itemIds).not.toContain(shopCampinasId); // ~80km
      });

      it("excludes unconfirmed shops and stale shops from nearby discovery", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 50,
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        const itemIds = body.items.map((i: any) => i.id);
        expect(itemIds).not.toContain(shopUnconfirmedId);
        expect(itemIds).not.toContain(shopStaleId);
      });

      it("combines proximity with text search query", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
          q: "paulista",
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe(shopPaulistaId);
      });

      it("preserves privacy: client coordinates are not leaked in response body", async () => {
        const clientLat = -23.550912;
        const clientLon = -46.633845;
        const response = await post("/barbershops/nearby", {
          latitude: clientLat,
          longitude: clientLon,
          radiusKm: 10,
        });
        expect(response.status).toBe(200);

        const rawText = await response.text();
        const body = JSON.parse(rawText);

        // Client input coordinates must never be echoed in the response
        expect(rawText).not.toContain(String(clientLat));
        expect(rawText).not.toContain(String(clientLon));

        // Shops must not leak internal tracking, Google, or owner mutation fields
        for (const shop of body.items) {
          expect(shop).not.toHaveProperty("googlePlaceId");
          expect(shop).not.toHaveProperty("lastMutationHash");
          expect(shop).not.toHaveProperty("ownerId");
          expect(shop).not.toHaveProperty("cnpj");
        }
      });

      it("accepts (0,0) as a valid coordinate pair without error", async () => {
        const response = await post("/barbershops/nearby", {
          latitude: 0,
          longitude: 0,
          radiusKm: 5,
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.items).toHaveLength(0); // No shops in Gulf of Guinea
        expect(body.total).toBe(0);
      });
    });

    // ==========================================
    // 3. Maintenance Mode / Health Flag (503)
    // ==========================================
    describe("Maintenance Mode & Resilience", () => {
      it("returns 503 for nearby search when location maintenance is active, while GET / continues operating", async () => {
        // Activate maintenance mode
        await isolated.pool.query(`
          INSERT INTO location_maintenance_health (component, is_healthy, details, updated_at)
          VALUES ('google_maps_cache', false, 'Maintenance active', now())
          ON CONFLICT (component) DO UPDATE
          SET is_healthy = false, details = 'Maintenance active', updated_at = now();
        `);

        // POST /nearby must return 503
        const nearbyRes = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
        });
        expect(nearbyRes.status).toBe(503);
        const nearbyBody = (await nearbyRes.json()) as any;
        expect(nearbyBody.error).toContain(
          "Serviço de busca por proximidade temporariamente indisponível",
        );

        // GET /barbershops must CONTINUE to work normally (200 OK)
        const getRes = await get("/barbershops");
        expect(getRes.status).toBe(200);

        // Restore healthy state
        await isolated.pool.query(`
          UPDATE location_maintenance_health
          SET is_healthy = true, last_heartbeat_at = now(), details = 'Healthy', updated_at = now()
          WHERE component = 'google_maps_cache';
        `);

        // POST /nearby should now succeed with 200
        const restoredRes = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
        });
        expect(restoredRes.status).toBe(200);
      });
    });

    // ==========================================
    // 4. Privacy, Error Sanitization & Strict Request Boundaries
    // ==========================================
    describe("Privacy, Error Sanitization & Strict Request Boundaries", () => {
      it("rejects coordinates and radius provided via query string on POST /api/barbershops/nearby with 400 and Cache-Control: no-store", async () => {
        const res = await post(
          "/barbershops/nearby?latitude=-23.55052&longitude=-46.633308&radiusKm=10",
          {
            latitude: refLat,
            longitude: refLon,
            radiusKm: 10,
          },
        );

        expect(res.status).toBe(400);
        expect(res.headers.get("cache-control")).toContain("no-store");
        expect(res.headers.get("pragma")).toBe("no-cache");

        const body = (await res.json()) as any;
        expect(body.error).toContain(
          "Coordenadas e raio não são permitidos na query string. Devem ser enviados exclusivamente no corpo JSON da requisição.",
        );
      });

      it("sanitizes unexpected internal errors so synthetic coordinates/markers are never logged or leaked in response body", async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        const searchSpy = vi
          .spyOn(DrizzleDiscoveryRepository.prototype, "search")
          .mockRejectedValueOnce(
            new Error(
              "SYNTHETIC_CRITICAL_SQL_FAILURE MARKER_LAT_77123 MARKER_LON_88456",
            ),
          );

        const res = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
        });

        expect(res.status).toBe(500);
        expect(res.headers.get("cache-control")).toContain("no-store");
        expect(res.headers.get("pragma")).toBe("no-cache");

        const body = (await res.json()) as any;
        expect(body.error).toBe(
          "Erro interno no serviço de descoberta por proximidade.",
        );
        expect(JSON.stringify(body)).not.toContain("MARKER_LAT_77123");
        expect(JSON.stringify(body)).not.toContain("MARKER_LON_88456");

        // Verify console.error calls did NOT leak the synthetic position markers
        const loggedTexts = consoleErrorSpy.mock.calls
          .flat()
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg),
          )
          .join(" ");
        expect(loggedTexts).not.toContain("MARKER_LAT_77123");
        expect(loggedTexts).not.toContain("MARKER_LON_88456");

        searchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });

      it("sanitizes unexpected internal errors on GET /barbershops without exposing database internals", async () => {
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        const searchSpy = vi
          .spyOn(DrizzleDiscoveryRepository.prototype, "search")
          .mockRejectedValueOnce(
            new Error("SYNTHETIC_DB_DISASTER_MARKER_9999"),
          );

        const res = await get("/barbershops");
        expect(res.status).toBe(500);
        const body = (await res.json()) as any;
        expect(JSON.stringify(body)).not.toContain(
          "SYNTHETIC_DB_DISASTER_MARKER_9999",
        );

        searchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });
    });

    // ==========================================
    // 5. Performance Benchmark: 10.000 Synthetic Units
    // ==========================================
    describe("Performance Benchmark (10.000 Synthetic Barbershops)", () => {
      beforeAll(async () => {
        // Bulk insert 10.000 units spread across São Paulo
        const bulkOwnerId = "10000000-0000-0000-0000-000000000099";
        await isolated.pool.query(`
          INSERT INTO users (id, name, email, password, cpf)
          VALUES ('${bulkOwnerId}', 'Bulk Owner', 'bulk.benchmark@example.com', 'pwd', '99988877711')
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
          SELECT
            gen_random_uuid(),
            'Synthetic Barbershop ' || s,
            '${bulkOwnerId}',
            'synthetic-shop-' || s || '-' || substr(md5(random()::text), 1, 6),
            '88' || lpad(s::text, 12, '0'),
            'Rua Sintética, ' || s || ' - SP',
            'ACTIVE'
          FROM generate_series(1, 10000) s;

          INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, valid_until, version)
          SELECT
            b.id,
            'CONFIRMED',
            ${refLat} + (random() - 0.5) * 1.5,
            ${refLon} + (random() - 0.5) * 1.5,
            'MANUAL',
            now() + interval '20 days',
            1
          FROM barbershops b
          WHERE b.owner_id = '${bulkOwnerId}';
        `);
      });

      it("executes proximity search in <= 200 ms with 10.000 records in database", async () => {
        const start = performance.now();

        const response = await post("/barbershops/nearby", {
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
          limit: 20,
        });

        const elapsed = performance.now() - start;

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items.length).toBeLessThanOrEqual(20);

        console.log(
          `[Performance Benchmark] Proximity search with 10.000 units executed in ${elapsed.toFixed(1)} ms (budget <= 200 ms).`,
        );

        // Verification of SLA budget (<= 200 ms)
        expect(elapsed).toBeLessThanOrEqual(200);
      });
    });
  },
);
