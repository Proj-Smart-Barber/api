export interface GeocodingCandidatePersistence {
  id: string;
  actorId: string;
  barbershopId: string | null;
  addressHash: string;
  latitude: number;
  longitude: number;
  placeId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface GeocodingCandidatesRepository {
  findById(id: string, tx?: any): Promise<GeocodingCandidatePersistence | null>;
  create(
    candidate: Omit<GeocodingCandidatePersistence, "createdAt" | "consumedAt">,
    tx?: any,
  ): Promise<GeocodingCandidatePersistence>;
  consume(id: string, tx?: any): Promise<void>;
  deleteExpired(now?: Date, tx?: any): Promise<number>;
  checkAndIncrementUsage(
    actorId: string,
    limitPerHour?: number,
    limitPerDay?: number,
    tx?: any,
  ): Promise<boolean>;
}
