import type {
  BarbershopLocationsRepository,
  BarbershopLocationPersistence,
} from "../../src/domain/application/repositories/barbershop-locations-repository";
import type {
  LocationState,
  SetLocationCommand,
} from "../../src/domain/application/services/discovery-contract";

export class InMemoryBarbershopLocationsRepository
  implements BarbershopLocationsRepository
{
  public items: BarbershopLocationPersistence[] = [];

  async findByBarbershopId(
    barbershopId: string,
  ): Promise<BarbershopLocationPersistence | null> {
    const item = this.items.find((l) => l.barbershopId === barbershopId);
    return item ?? null;
  }

  async saveLocation(
    data: Partial<BarbershopLocationPersistence> & { barbershopId: string },
  ): Promise<BarbershopLocationPersistence> {
    const existingIndex = this.items.findIndex(
      (l) => l.barbershopId === data.barbershopId,
    );

    const now = new Date();
    const existing = existingIndex >= 0 ? this.items[existingIndex] : null;

    const record: BarbershopLocationPersistence = {
      id: existing ? existing.id : crypto.randomUUID(),
      barbershopId: data.barbershopId,
      status: data.status ?? existing?.status ?? "CONFIRMED",
      latitude:
        data.latitude !== undefined
          ? data.latitude
          : (existing?.latitude ?? null),
      longitude:
        data.longitude !== undefined
          ? data.longitude
          : (existing?.longitude ?? null),
      version: data.version ?? (existing ? existing.version + 1 : 1),
      confirmedAt:
        data.confirmedAt !== undefined
          ? data.confirmedAt
          : (existing?.confirmedAt ?? now),
      source: data.source ?? existing?.source ?? "GOOGLE",
      googlePlaceId:
        data.googlePlaceId !== undefined
          ? data.googlePlaceId
          : (existing?.googlePlaceId ?? null),
      googleReference:
        data.googleReference !== undefined
          ? data.googleReference
          : (existing?.googleReference ?? null),
      acquiredAt:
        data.acquiredAt !== undefined
          ? data.acquiredAt
          : (existing?.acquiredAt ?? now),
      validUntil:
        data.validUntil !== undefined
          ? data.validUntil
          : (existing?.validUntil ?? null),
      pinAdjusted:
        data.pinAdjusted !== undefined
          ? data.pinAdjusted
          : (existing?.pinAdjusted ?? false),
      lastMutationId:
        data.lastMutationId !== undefined
          ? data.lastMutationId
          : (existing?.lastMutationId ?? null),
      lastMutationActorId:
        data.lastMutationActorId !== undefined
          ? data.lastMutationActorId
          : (existing?.lastMutationActorId ?? null),
      lastMutationHash:
        data.lastMutationHash !== undefined
          ? data.lastMutationHash
          : (existing?.lastMutationHash ?? null),
      lastMutationSavedVersion:
        data.lastMutationSavedVersion !== undefined
          ? data.lastMutationSavedVersion
          : (existing?.lastMutationSavedVersion ?? null),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      this.items[existingIndex] = record;
    } else {
      this.items.push(record);
    }

    return record;
  }

  async findLocationState(barbershopId: string): Promise<LocationState | null> {
    const item = await this.findByBarbershopId(barbershopId);
    if (!item) return null;

    return {
      shopId: item.barbershopId,
      address: "",
      status: item.status,
      source: item.source as any,
      version: item.version,
      point:
        item.latitude !== null && item.longitude !== null
          ? { latitude: item.latitude, longitude: item.longitude }
          : null,
      confirmedAt: item.confirmedAt?.toISOString() ?? null,
      acquiredAt: item.acquiredAt?.toISOString() ?? null,
      validUntil: item.validUntil?.toISOString() ?? null,
      lastOwnerMutation: item.lastMutationId
        ? {
            id: item.lastMutationId,
            commandHash: item.lastMutationHash ?? "",
            savedVersion: item.lastMutationSavedVersion ?? item.version,
          }
        : null,
    };
  }
}
