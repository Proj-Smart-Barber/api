export interface ExploreFeedMediaItem {
  id: string;
  kind: "environment" | "service" | "team";
  mediaId: string;
  mimeType?: string;
  posterUrl?: string;
  durationSeconds?: number;
  serviceId: string | null;
  url: string;
  variants?: Record<string, string>;
  width: number;
  height: number;
  alt: string;
  focalPoint?: string;
  category?: string;
  rightsPending?: boolean;
  service?: {
    id: string;
    title: string;
    priceInCents: number;
    durationInMinutes: number;
    rating?: number | null;
    reviewCount?: number;
  } | null;
}

export interface ExploreFeedItem {
  barbershop: {
    id: string;
    slug: string;
    name: string;
    location: string;
    logoUrl: string | null;
    rating: number | null;
    reviewCount: number;
    googleMapsUrl?: string | null;
  };
  distanceMeters: number | null;
  distanceBasis: "user" | "region" | "unavailable";
  rankingScore: {
    score: number;
    distanceComponent: number | null;
    reputationComponent: number;
    bayesRating: number;
  };
  media: ExploreFeedMediaItem[];
}

export interface ExploreFeedPage {
  items: ExploreFeedItem[];
  nextCursor: string | null;
  hasNext: boolean;
  total: number;
  rankingVersion: string;
  snapshotExpiresAt: string;
}

export interface ExploreFeedInput {
  mode: "ALL" | "NEARBY";
  point?: { latitude: number; longitude: number };
  radiusKm?: 5 | 10 | 25 | 50;
  q?: string;
  regionKey?: string;
  limit?: number;
  cursor?: string;
}
