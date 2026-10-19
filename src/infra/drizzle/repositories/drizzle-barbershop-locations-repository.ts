import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { barbershops, barbershopLocations } from "../schema";
import type {
  BarbershopLocationPersistence,
  BarbershopLocationsRepository,
} from "../../../domain/application/repositories/barbershop-locations-repository";
import type {
  LocationState,
  LocationStatus,
  LocationSource,
} from "../../../domain/application/services/discovery-contract";

export class DrizzleBarbershopLocationsRepository
  implements BarbershopLocationsRepository
{
  // biome-ignore lint/suspicious/noExplicitAny: supports default project db or isolated test database
  private customDb?: any;

  constructor(customDb?: any) {
    this.customDb = customDb;
  }

  private get database(): any {
    return this.customDb ?? db;
  }

  async findByBarbershopId(
    barbershopId: string,
    tx?: any,
  ): Promise<BarbershopLocationPersistence | null> {
    const executor = tx ?? this.database;
    const [row] = await executor
      .select()
      .from(barbershopLocations)
      .where(eq(barbershopLocations.barbershopId, barbershopId));

    if (!row) return null;

    return {
      id: row.id,
      barbershopId: row.barbershopId,
      status: row.status as LocationStatus,
      latitude: row.latitude,
      longitude: row.longitude,
      version: row.version,
      confirmedAt: row.confirmedAt,
      source: row.source,
      googlePlaceId: row.googlePlaceId,
      googleReference: row.googleReference,
      acquiredAt: row.acquiredAt,
      validUntil: row.validUntil,
      pinAdjusted: row.pinAdjusted,
      lastMutationId: row.lastMutationId,
      lastMutationActorId: row.lastMutationActorId,
      lastMutationHash: row.lastMutationHash,
      lastMutationSavedVersion: row.lastMutationSavedVersion,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };
  }

  async findLocationState(
    barbershopId: string,
    tx?: any,
  ): Promise<LocationState | null> {
    const executor = tx ?? this.database;

    const [shop] = await executor
      .select({
        id: barbershops.id,
        location: barbershops.location,
      })
      .from(barbershops)
      .where(eq(barbershops.id, barbershopId));

    if (!shop) return null;

    const [loc] = await executor
      .select()
      .from(barbershopLocations)
      .where(eq(barbershopLocations.barbershopId, barbershopId));

    if (!loc) {
      return {
        shopId: shop.id,
        address: shop.location,
        status: "UNCONFIRMED",
        source: "MANUAL",
        version: 0,
        point: null,
        confirmedAt: null,
        acquiredAt: null,
        validUntil: null,
        lastOwnerMutation: null,
      };
    }

    return {
      shopId: shop.id,
      address: shop.location,
      status: loc.status as LocationStatus,
      source: loc.source as LocationSource,
      version: loc.version,
      point:
        loc.latitude !== null && loc.longitude !== null
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : null,
      confirmedAt: loc.confirmedAt ? loc.confirmedAt.toISOString() : null,
      acquiredAt: loc.acquiredAt ? loc.acquiredAt.toISOString() : null,
      validUntil: loc.validUntil ? loc.validUntil.toISOString() : null,
      lastOwnerMutation:
        loc.lastMutationId &&
        loc.lastMutationHash &&
        loc.lastMutationSavedVersion !== null
          ? {
              id: loc.lastMutationId,
              commandHash: loc.lastMutationHash,
              savedVersion: loc.lastMutationSavedVersion,
            }
          : null,
    };
  }

  async saveLocation(
    data: Partial<BarbershopLocationPersistence> & { barbershopId: string },
    tx?: any,
    expectedVersion?: number,
  ): Promise<BarbershopLocationPersistence> {
    const executor = tx ?? this.database;

    const existing = await this.findByBarbershopId(data.barbershopId, tx);

    if (existing) {
      const updateCondition =
        expectedVersion !== undefined
          ? and(
              eq(barbershopLocations.barbershopId, data.barbershopId),
              eq(barbershopLocations.version, expectedVersion),
            )
          : eq(barbershopLocations.barbershopId, data.barbershopId);

      const [updated] = await executor
        .update(barbershopLocations)
        .set({
          status: data.status ?? existing.status,
          latitude:
            data.latitude !== undefined ? data.latitude : existing.latitude,
          longitude:
            data.longitude !== undefined ? data.longitude : existing.longitude,
          version: data.version ?? existing.version,
          confirmedAt:
            data.confirmedAt !== undefined
              ? data.confirmedAt
              : existing.confirmedAt,
          source: data.source ?? existing.source,
          googlePlaceId:
            data.googlePlaceId !== undefined
              ? data.googlePlaceId
              : existing.googlePlaceId,
          googleReference:
            data.googleReference !== undefined
              ? data.googleReference
              : existing.googleReference,
          acquiredAt:
            data.acquiredAt !== undefined
              ? data.acquiredAt
              : existing.acquiredAt,
          validUntil:
            data.validUntil !== undefined
              ? data.validUntil
              : existing.validUntil,
          pinAdjusted:
            data.pinAdjusted !== undefined
              ? data.pinAdjusted
              : existing.pinAdjusted,
          lastMutationId:
            data.lastMutationId !== undefined
              ? data.lastMutationId
              : existing.lastMutationId,
          lastMutationActorId:
            data.lastMutationActorId !== undefined
              ? data.lastMutationActorId
              : existing.lastMutationActorId,
          lastMutationHash:
            data.lastMutationHash !== undefined
              ? data.lastMutationHash
              : existing.lastMutationHash,
          lastMutationSavedVersion:
            data.lastMutationSavedVersion !== undefined
              ? data.lastMutationSavedVersion
              : existing.lastMutationSavedVersion,
          updatedAt: new Date(),
        })
        .where(updateCondition)
        .returning();

      if (!updated) {
        throw new Error("LOCATION_VERSION_CONFLICT");
      }

      return {
        id: updated.id,
        barbershopId: updated.barbershopId,
        status: updated.status as LocationStatus,
        latitude: updated.latitude,
        longitude: updated.longitude,
        version: updated.version,
        confirmedAt: updated.confirmedAt,
        source: updated.source,
        googlePlaceId: updated.googlePlaceId,
        googleReference: updated.googleReference,
        acquiredAt: updated.acquiredAt,
        validUntil: updated.validUntil,
        pinAdjusted: updated.pinAdjusted,
        lastMutationId: updated.lastMutationId,
        lastMutationActorId: updated.lastMutationActorId,
        lastMutationHash: updated.lastMutationHash,
        lastMutationSavedVersion: updated.lastMutationSavedVersion,
        createdAt: updated.createdAt ?? new Date(),
        updatedAt: updated.updatedAt ?? new Date(),
      };
    }

    const [inserted] = await executor
      .insert(barbershopLocations)
      .values({
        barbershopId: data.barbershopId,
        status: data.status ?? "CONFIRMED",
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        version: data.version ?? 1,
        confirmedAt: data.confirmedAt ?? new Date(),
        source: data.source ?? "GOOGLE",
        googlePlaceId: data.googlePlaceId ?? null,
        googleReference: data.googleReference ?? null,
        acquiredAt: data.acquiredAt ?? new Date(),
        validUntil: data.validUntil ?? null,
        pinAdjusted: data.pinAdjusted ?? false,
        lastMutationId: data.lastMutationId ?? null,
        lastMutationActorId: data.lastMutationActorId ?? null,
        lastMutationHash: data.lastMutationHash ?? null,
        lastMutationSavedVersion: data.lastMutationSavedVersion ?? null,
      })
      .returning();

    return {
      id: inserted.id,
      barbershopId: inserted.barbershopId,
      status: inserted.status as LocationStatus,
      latitude: inserted.latitude,
      longitude: inserted.longitude,
      version: inserted.version,
      confirmedAt: inserted.confirmedAt,
      source: inserted.source,
      googlePlaceId: inserted.googlePlaceId,
      googleReference: inserted.googleReference,
      acquiredAt: inserted.acquiredAt,
      validUntil: inserted.validUntil,
      pinAdjusted: inserted.pinAdjusted,
      lastMutationId: inserted.lastMutationId,
      lastMutationActorId: inserted.lastMutationActorId,
      lastMutationHash: inserted.lastMutationHash,
      lastMutationSavedVersion: inserted.lastMutationSavedVersion,
      createdAt: inserted.createdAt ?? new Date(),
      updatedAt: inserted.updatedAt ?? new Date(),
    };
  }
}
