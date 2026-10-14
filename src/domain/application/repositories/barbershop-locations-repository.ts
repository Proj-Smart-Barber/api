import type {
  LocationState,
  LocationStatus,
  SetLocationCommand,
} from "../services/discovery-contract";

export interface BarbershopLocationPersistence {
  id: string;
  barbershopId: string;
  status: LocationStatus;
  latitude: number | null;
  longitude: number | null;
  version: number;
  confirmedAt: Date | null;
  source: string;
  googlePlaceId: string | null;
  googleReference: string | null;
  acquiredAt: Date | null;
  validUntil: Date | null;
  pinAdjusted: boolean;
  lastMutationId: string | null;
  lastMutationActorId: string | null;
  lastMutationHash: string | null;
  lastMutationSavedVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BarbershopLocationsRepository {
  findByBarbershopId(
    barbershopId: string,
  ): Promise<BarbershopLocationPersistence | null>;
  saveLocation(
    command: SetLocationCommand,
  ): Promise<BarbershopLocationPersistence>;
  findLocationState(barbershopId: string): Promise<LocationState | null>;
}
