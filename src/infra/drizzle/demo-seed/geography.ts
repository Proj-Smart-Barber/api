import { and, eq, sql } from "drizzle-orm";
import { isValidGeoPoint } from "../../../domain/application/services/discovery-contract";
import { barbershopLocations, barbershops } from "../schema";
import { DEMO_SEED_NAMESPACE, type DemoBarbershopFixture } from "./types";

type DemoGeographyResult = {
  action: "created" | "updated" | "reused" | "preserved";
  locationId: string;
};

export async function reconcileDemoGeography(
  // biome-ignore lint/suspicious/noExplicitAny: accepts the production driver and isolated PostgreSQL test driver
  database: any,
  shopId: string,
  fixture: DemoBarbershopFixture,
  expectedOwnerId: string,
): Promise<DemoGeographyResult> {
  if (
    !fixture.name.includes("Demonstração") ||
    !fixture.slug.endsWith("-demo") ||
    !isValidGeoPoint(fixture.point)
  ) {
    throw new Error(
      "Demo geography requires an identified demo fixture with valid coordinates.",
    );
  }
  // biome-ignore lint/suspicious/noExplicitAny: transaction driver follows the injected database
  return database.transaction(async (tx: any) => {
    const [shop] = await tx
      .select()
      .from(barbershops)
      .where(
        and(
          eq(barbershops.id, shopId),
          eq(barbershops.slug, fixture.slug),
          eq(barbershops.cnpj, fixture.cnpj),
          eq(barbershops.name, fixture.name),
          eq(barbershops.ownerId, expectedOwnerId),
        ),
      )
      .for("update");
    const registeredShop = await tx.execute(sql`
      SELECT record_id FROM demo_seed_registry
      WHERE namespace = ${DEMO_SEED_NAMESPACE} AND logical_key = ${fixture.logicalKey}
        AND table_name = 'barbershops' AND record_id = ${shopId}::uuid
    `);
    if (!shop || registeredShop.rows.length !== 1) {
      throw new Error(
        "Demo geography only accepts the registered fixture shop.",
      );
    }
    const [current] = await tx
      .select()
      .from(barbershopLocations)
      .where(eq(barbershopLocations.barbershopId, shopId))
      .for("update");
    const locationKey = `${fixture.logicalKey}:location`;
    const registeredLocation = await tx.execute(sql`
      SELECT record_id FROM demo_seed_registry
      WHERE namespace = ${DEMO_SEED_NAMESPACE} AND logical_key = ${locationKey}
        AND table_name = 'barbershop_locations'
    `);
    if (
      current &&
      (registeredLocation.rows[0]?.record_id !== current.id ||
        current.lastMutationId ||
        current.lastMutationActorId ||
        current.source !== "MANUAL")
    ) {
      return { action: "preserved" as const, locationId: current.id };
    }
    if (
      current &&
      shop.location === fixture.location &&
      current.status === "CONFIRMED" &&
      current.latitude === fixture.point.latitude &&
      current.longitude === fixture.point.longitude &&
      current.googlePlaceId === null &&
      current.googleReference === null &&
      current.validUntil === null
    ) {
      return { action: "reused" as const, locationId: current.id };
    }
    await tx
      .update(barbershops)
      .set({ location: fixture.location })
      .where(eq(barbershops.id, shopId));
    const values = {
      status: "CONFIRMED" as const,
      source: "MANUAL",
      latitude: fixture.point.latitude,
      longitude: fixture.point.longitude,
      confirmedAt: new Date(),
      googlePlaceId: null,
      googleReference: null,
      acquiredAt: null,
      validUntil: null,
      pinAdjusted: false,
    };
    let locationId: string;
    if (current) {
      await tx
        .update(barbershopLocations)
        .set({ ...values, version: current.version + 1 })
        .where(eq(barbershopLocations.id, current.id));
      locationId = current.id;
    } else {
      const [created] = await tx
        .insert(barbershopLocations)
        .values({ ...values, barbershopId: shopId })
        .returning({ id: barbershopLocations.id });
      locationId = created.id;
    }
    await tx.execute(sql`
      INSERT INTO demo_seed_registry (namespace, logical_key, table_name, record_id)
      VALUES (${DEMO_SEED_NAMESPACE}, ${locationKey}, 'barbershop_locations', ${locationId}::uuid)
      ON CONFLICT (namespace, logical_key) DO UPDATE SET record_id = EXCLUDED.record_id
    `);
    return {
      action: current ? ("updated" as const) : ("created" as const),
      locationId,
    };
  });
}
