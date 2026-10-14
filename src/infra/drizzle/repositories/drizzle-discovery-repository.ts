import { sql } from "drizzle-orm";
import type { DiscoveryRepository } from "../../../domain/application/repositories/discovery-repository";
import type {
  DiscoveryInput,
  DiscoveryPage,
  GeoPoint,
  PublicShop,
} from "../../../domain/application/services/discovery-contract";
import { db } from "../index";

export class DrizzleDiscoveryRepository implements DiscoveryRepository {
  // biome-ignore lint/suspicious/noExplicitAny: supports default project db or isolated test database
  private customDb?: any;

  // biome-ignore lint/suspicious/noExplicitAny: default to project db
  constructor(customDb?: any) {
    this.customDb = customDb;
  }

  // biome-ignore lint/suspicious/noExplicitAny: dynamically resolves db to support test mock getters
  private get database(): any {
    return this.customDb ?? db;
  }

  async isLocationServiceHealthy(): Promise<boolean> {
    try {
      const result = await this.database.execute(sql`
        SELECT is_healthy
        FROM location_maintenance_health
        WHERE component = 'google_maps_cache'
        LIMIT 1
      `);
      if (!result.rows || result.rows.length === 0) {
        return true;
      }
      return Boolean(result.rows[0].is_healthy);
    } catch {
      // If table query fails, fail-closed for nearby maintenance
      return false;
    }
  }

  async search(input: DiscoveryInput): Promise<DiscoveryPage> {
    const page = Math.max(1, input.page);
    const limit = Math.max(1, Math.min(50, input.limit));
    const offset = (page - 1) * limit;
    const serverTime = new Date().toISOString();

    if (input.mode === "ALL") {
      return this.searchAll(input, page, limit, offset, serverTime);
    }

    return this.searchNearby(input, page, limit, offset, serverTime);
  }

  private async searchAll(
    input: DiscoveryInput & { mode: "ALL" },
    page: number,
    limit: number,
    offset: number,
    serverTime: string,
  ): Promise<DiscoveryPage> {
    const conditions = [sql`b.status = 'ACTIVE'`];

    if (input.q && input.q.trim().length > 0) {
      const sanitized = input.q
        .trim()
        .slice(0, 120)
        .replace(/[%_\\]/g, "\\$&");
      const term = `%${sanitized}%`;
      conditions.push(sql`(b.name ILIKE ${term} OR b.location ILIKE ${term})`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const countResult = await this.database.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM barbershops b
      WHERE ${whereClause}
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const rowsResult = await this.database.execute(sql`
      SELECT
        b.id,
        b.name,
        b.slug,
        b.location,
        b.avatar_url,
        bl.status AS location_status,
        bl.latitude,
        bl.longitude,
        bl.valid_until
      FROM barbershops b
      LEFT JOIN barbershop_locations bl ON bl.barbershop_id = b.id
      WHERE ${whereClause}
      ORDER BY lower(b.name) ASC, b.id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const now = new Date();
    const items: PublicShop[] = rowsResult.rows.map((row: any) => {
      const isEligible =
        row.location_status === "CONFIRMED" &&
        row.latitude !== null &&
        row.longitude !== null &&
        (row.valid_until === null || new Date(row.valid_until) > now);

      const coordinates: GeoPoint | null = isEligible
        ? {
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
          }
        : null;

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        location: row.location,
        avatarUrl: row.avatar_url ?? null,
        coordinates,
        distanceMeters: null,
      };
    });

    return {
      items,
      page,
      limit,
      total,
      hasNext: page * limit < total,
      serverTime,
    };
  }

  private async searchNearby(
    input: DiscoveryInput & { mode: "NEARBY" },
    page: number,
    limit: number,
    offset: number,
    serverTime: string,
  ): Promise<DiscoveryPage> {
    const { point, radiusKm } = input;
    const radiusMeters = radiusKm * 1000;
    const lat = point.latitude;
    const lon = point.longitude;

    // Bounding box pre-filter optimization
    const deltaLat = radiusKm / 111.32;
    const cosLat = Math.cos((lat * Math.PI) / 180.0);
    const deltaLon =
      Math.abs(lat) < 89.9 && cosLat > 0.0001
        ? radiusKm / (111.32 * cosLat)
        : 180.0;

    const minLat = Math.max(-90.0, lat - deltaLat);
    const maxLat = Math.min(90.0, lat + deltaLat);
    const minLon = lon - deltaLon;
    const maxLon = lon + deltaLon;

    // Exact spherical Haversine formula (Earth R = 6,371,000 m) with numerical clamping [0, 1]
    const haversineSql = sql`
      2.0 * 6371000.0 * asin(sqrt(
        least(1.0::double precision, greatest(0.0::double precision,
          power(sin(radians(bl.latitude - ${lat}::double precision) / 2.0), 2) +
          cos(radians(${lat}::double precision)) * cos(radians(bl.latitude)) * power(sin(radians(bl.longitude - ${lon}::double precision) / 2.0), 2)
        ))
      ))
    `;

    const conditions = [
      sql`b.status = 'ACTIVE'`,
      sql`bl.status = 'CONFIRMED'`,
      sql`bl.latitude IS NOT NULL`,
      sql`bl.longitude IS NOT NULL`,
      sql`bl.latitude BETWEEN ${minLat}::double precision AND ${maxLat}::double precision`,
      sql`(bl.valid_until IS NULL OR bl.valid_until > NOW())`,
    ];

    if (deltaLon < 180.0) {
      conditions.push(
        sql`bl.longitude BETWEEN ${minLon}::double precision AND ${maxLon}::double precision`,
      );
    }

    if (input.q && input.q.trim().length > 0) {
      const sanitized = input.q
        .trim()
        .slice(0, 120)
        .replace(/[%_\\]/g, "\\$&");
      const term = `%${sanitized}%`;
      conditions.push(sql`(b.name ILIKE ${term} OR b.location ILIKE ${term})`);
    }

    const baseWhere = sql.join(conditions, sql` AND `);

    // Count matching within radius
    const countResult = await this.database.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM barbershops b
      INNER JOIN barbershop_locations bl ON bl.barbershop_id = b.id
      WHERE ${baseWhere}
        AND (${haversineSql}) <= ${radiusMeters}::double precision
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);

    // Query items within radius ordered by distance ASC, id ASC
    const rowsResult = await this.database.execute(sql`
      SELECT
        b.id,
        b.name,
        b.slug,
        b.location,
        b.avatar_url,
        bl.latitude,
        bl.longitude,
        (${haversineSql}) AS distance_meters
      FROM barbershops b
      INNER JOIN barbershop_locations bl ON bl.barbershop_id = b.id
      WHERE ${baseWhere}
        AND (${haversineSql}) <= ${radiusMeters}::double precision
      ORDER BY distance_meters ASC, b.id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const items: PublicShop[] = rowsResult.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      location: row.location,
      avatarUrl: row.avatar_url ?? null,
      coordinates: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      },
      distanceMeters: Number(row.distance_meters),
    }));

    return {
      items,
      page,
      limit,
      total,
      hasNext: page * limit < total,
      serverTime,
    };
  }
}
