import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createPhase1TestDatabase } from "../../../../test/helpers/isolated-phase1-db";
import {
  barbershopLocations,
  barbershops,
  membership,
  services,
  barbershopSchedules,
} from "../schema";
import { DrizzleGeocodingCandidatesRepository } from "../repositories/drizzle-geocoding-candidates-repository";
import { DrizzleDiscoveryRepository } from "../repositories/drizzle-discovery-repository";
import { SearchBarbershopsUseCase } from "../../../domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import { DEMO_BARBERSHOPS } from "./fixtures";
import { RefreshLocationsMaintenanceUseCase } from "../../../domain/application/use-cases/location/refresh-locations-maintenance/refresh-locations-maintenance";
import { DemoSeedEngine } from "./engine";
import { reconcileDemoGeography } from "./geography";
import type { DemoStaffFixture } from "./types";

const runtime = vi.hoisted(() => ({
  database: null as unknown,
  url: "postgresql://invalid:invalid@127.0.0.1:9/blocked",
}));
vi.mock("../index", () => ({
  get db() {
    return runtime.database;
  },
}));
vi.mock("../../env", () => ({
  env: {
    get DATABASE_URL() {
      return runtime.url;
    },
  },
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  writeFileSync: vi.fn(),
}));
vi.mock("./security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./security")>()),
  loadOrCreateStaffCredentials: vi.fn(async (staffs: DemoStaffFixture[]) =>
    Object.fromEntries(
      staffs.map((staff) => [
        staff.logicalKey,
        { passwordHash: staff.defaultPasswordHash },
      ]),
    ),
  ),
}));

const target = process.env.PHASE1_TEST_DATABASE_URL;
describe.skipIf(!target)(
  "Regional demo geography on disposable PostgreSQL",
  () => {
    let isolated: Awaited<ReturnType<typeof createPhase1TestDatabase>>;
    let ids: Record<string, string>;
    beforeAll(async () => {
      if (!target)
        throw new Error("A local disposable PostgreSQL URL is required.");
      isolated = await createPhase1TestDatabase(target);
      runtime.database = isolated.db;
      const url = new URL(target);
      url.pathname = `/${isolated.database}`;
      runtime.url = url.toString();
    }, 60000);
    afterAll(async () => {
      await isolated?.close();
    });

    it("dry-run plans five locations without creating shops or registry", async () => {
      const summary = await new DemoSeedEngine().run({ dryRun: true });
      expect(summary.counts.barbershops.planned).toBe(5);
      expect(summary.counts.barbershop_locations.planned).toBe(5);
      expect(await isolated.db.select().from(barbershops)).toHaveLength(0);
      const registry = await isolated.pool.query(
        "SELECT to_regclass('public.demo_seed_registry') AS name",
      );
      expect(registry.rows[0].name).toBeNull();
    });

    it("apply provides five geolocated units with an owner, catalog and schedules", async () => {
      const summary = await new DemoSeedEngine().run();
      ids = summary.createdIds;
      expect(summary.counts.barbershop_locations.created).toBe(5);
      expect(await isolated.db.select().from(membership)).toHaveLength(11);
      expect(await isolated.db.select().from(services)).toHaveLength(20);
      for (const fixture of DEMO_BARBERSHOPS) {
        const id = ids[fixture.logicalKey];
        const [point] = await isolated.db
          .select()
          .from(barbershopLocations)
          .where(eq(barbershopLocations.barbershopId, id));
        expect(point).toMatchObject({
          status: "CONFIRMED",
          source: "MANUAL",
          version: 1,
          latitude: fixture.point.latitude,
          longitude: fixture.point.longitude,
          validUntil: null,
        });
        const members = await isolated.db
          .select()
          .from(membership)
          .where(eq(membership.barbershopId, id));
        expect(
          members.some(
            (member) =>
              member.userId === ids[fixture.ownerLogicalKey] &&
              member.role === "OWNER",
          ),
        ).toBe(true);
        expect(
          (
            await isolated.db
              .select()
              .from(barbershopSchedules)
              .where(eq(barbershopSchedules.barbershopId, id))
          ).length,
        ).toBeGreaterThanOrEqual(6);
      }
    }, 60000);

    it("rerunning the seed preserves IDs and does not increment geographic versions", async () => {
      const summary = await new DemoSeedEngine().run();
      expect(summary.counts.barbershop_locations.reused).toBe(5);
      for (const fixture of DEMO_BARBERSHOPS)
        expect(summary.createdIds[fixture.logicalKey]).toBe(
          ids[fixture.logicalKey],
        );
      expect(await isolated.db.select().from(barbershopLocations)).toHaveLength(
        5,
      );
      expect(
        (await isolated.db.select().from(barbershopLocations)).every(
          (point) => point.version === 1,
        ),
      ).toBe(true);
    }, 60000);

    it("real maintenance and discovery find every fixture at its regional reference point", async () => {
      const maintenance = await new RefreshLocationsMaintenanceUseCase(
        new DrizzleGeocodingCandidatesRepository(),
        isolated.db,
      ).execute();
      expect(maintenance.isRight()).toBe(true);
      const discovery = new SearchBarbershopsUseCase(
        new DrizzleDiscoveryRepository(isolated.db),
      );
      for (const fixture of DEMO_BARBERSHOPS) {
        const result = await discovery.execute({
          mode: "NEARBY",
          point: fixture.point,
          radiusKm: 5,
          page: 1,
          limit: 50,
        });
        expect(result.isRight()).toBe(true);
        if (result.isRight()) {
          const found = result.value.items.find(
            (shop) => shop.id === ids[fixture.logicalKey],
          );
          expect(found?.distanceMeters).toBeLessThan(1);
        }
      }
    });

    it("never overwrites a location confirmed by an owner", async () => {
      const fixture = DEMO_BARBERSHOPS[2];
      const id = ids[fixture.logicalKey];
      await isolated.db
        .update(barbershops)
        .set({ location: "Endereço confirmado pelo proprietário" })
        .where(eq(barbershops.id, id));
      await isolated.db
        .update(barbershopLocations)
        .set({
          lastMutationId: randomUUID(),
          lastMutationActorId: ids[fixture.ownerLogicalKey],
          version: 4,
        })
        .where(eq(barbershopLocations.barbershopId, id));
      const summary = await new DemoSeedEngine().run();
      expect(summary.counts.barbershop_locations.preserved).toBe(1);
      const [shop] = await isolated.db
        .select()
        .from(barbershops)
        .where(eq(barbershops.id, id));
      expect(shop.location).toBe("Endereço confirmado pelo proprietário");
    }, 60000);

    it("refuses unregistered records and keeps the unrelated address untouched", async () => {
      const fixture = DEMO_BARBERSHOPS[0];
      await expect(
        reconcileDemoGeography(
          isolated.db,
          ids[fixture.logicalKey],
          fixture,
          ids[DEMO_BARBERSHOPS[1].ownerLogicalKey],
        ),
      ).rejects.toThrow("registered fixture");
      const id = randomUUID();
      await isolated.db.insert(barbershops).values({
        id,
        name: fixture.name,
        slug: `${fixture.slug}-unregistered`,
        cnpj: "12312312312312",
        ownerId: ids[fixture.ownerLogicalKey],
        location: "Unidade externa ao seed",
      });
      await expect(
        reconcileDemoGeography(
          isolated.db,
          id,
          fixture,
          ids[fixture.ownerLogicalKey],
        ),
      ).rejects.toThrow("registered fixture");
      const [shop] = await isolated.db
        .select()
        .from(barbershops)
        .where(eq(barbershops.id, id));
      expect(shop.location).toBe("Unidade externa ao seed");
    });

    it("concurrent reconciliation updates once and rolls back address changes on registry failure", async () => {
      const fixture = DEMO_BARBERSHOPS[4];
      const id = ids[fixture.logicalKey];
      await isolated.db
        .update(barbershops)
        .set({ location: "Endereço legado" })
        .where(eq(barbershops.id, id));
      const results = await Promise.all([
        reconcileDemoGeography(
          isolated.db,
          id,
          fixture,
          ids[fixture.ownerLogicalKey],
        ),
        reconcileDemoGeography(
          isolated.db,
          id,
          fixture,
          ids[fixture.ownerLogicalKey],
        ),
      ]);
      expect(results.map((result) => result.action).sort()).toEqual([
        "reused",
        "updated",
      ]);
      await isolated.db
        .update(barbershops)
        .set({ location: "Endereço para rollback" })
        .where(eq(barbershops.id, id));
      const [before] = await isolated.db
        .select()
        .from(barbershopLocations)
        .where(eq(barbershopLocations.barbershopId, id));
      await isolated.db.execute(
        sql.raw(
          "ALTER TABLE demo_seed_registry ADD CONSTRAINT block_geo_test CHECK (logical_key <> 'oeste:barbershop:location') NOT VALID",
        ),
      );
      try {
        await expect(
          reconcileDemoGeography(
            isolated.db,
            id,
            fixture,
            ids[fixture.ownerLogicalKey],
          ),
        ).rejects.toThrow();
        const [shop] = await isolated.db
          .select()
          .from(barbershops)
          .where(eq(barbershops.id, id));
        const [after] = await isolated.db
          .select()
          .from(barbershopLocations)
          .where(eq(barbershopLocations.barbershopId, id));
        expect(shop.location).toBe("Endereço para rollback");
        expect(after.version).toBe(before.version);
      } finally {
        await isolated.db.execute(
          sql`ALTER TABLE demo_seed_registry DROP CONSTRAINT block_geo_test`,
        );
      }
    });
  },
);
