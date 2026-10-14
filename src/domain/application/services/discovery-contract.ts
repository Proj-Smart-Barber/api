export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type DiscoveryInput =
  | { mode: "ALL"; q?: string; page: number; limit: number }
  | {
      mode: "NEARBY";
      point: GeoPoint;
      radiusKm: 5 | 10 | 25 | 50;
      q?: string;
      page: number;
      limit: number;
    };

export type PublicShop = {
  id: string;
  name: string;
  slug: string;
  location: string;
  avatarUrl: string | null;
  coordinates: GeoPoint | null;
  distanceMeters: number | null;
};

export type DiscoveryPage = {
  items: PublicShop[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  serverTime: string;
};

export type Candidate = {
  candidateId: string;
  displayAddress: string;
  point: GeoPoint;
  expiresAt: string;
  attribution: "Google Maps";
};

export type SetLocationCommand = {
  actorId: string;
  shopId: string;
  address: string;
  candidateId: string;
  point: GeoPoint;
  expectedVersion: number;
  mutationId: string;
};

export type LocationStatus = "UNCONFIRMED" | "CONFIRMED" | "NEEDS_REVIEW";
export type LocationSource = "MANUAL" | "GOOGLE";

export type LastOwnerMutation = {
  id: string;
  commandHash: string;
  savedVersion: number;
};

export type LocationState = {
  shopId: string;
  address: string;
  status: LocationStatus;
  source: LocationSource;
  version: number;
  point: GeoPoint | null;
  confirmedAt: string | null;
  acquiredAt: string | null;
  validUntil: string | null;
  lastOwnerMutation: LastOwnerMutation | null;
};

export function isValidGeoPoint(point: unknown): point is GeoPoint {
  if (!point || typeof point !== "object") return false;
  const p = point as { latitude?: unknown; longitude?: unknown };
  if (typeof p.latitude !== "number" || typeof p.longitude !== "number") {
    return false;
  }
  if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) {
    return false;
  }
  if (p.latitude < -90 || p.latitude > 90) return false;
  if (p.longitude < -180 || p.longitude > 180) return false;
  return true;
}
