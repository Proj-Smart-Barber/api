import type {ExploreFeedInput} from "../../../domain/application/services/explore-feed.contract";
import { type SQL, sql } from "drizzle-orm";
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
        SELECT is_healthy, last_heartbeat_at
        FROM location_maintenance_health
        WHERE component = 'google_maps_cache'
          AND is_healthy = true
          AND last_heartbeat_at IS NOT NULL
          AND last_heartbeat_at >= (NOW() - INTERVAL '36 hours')
          AND last_heartbeat_at <= (NOW() + INTERVAL '5 minutes')
        LIMIT 1
      `);
      if (!result.rows || result.rows.length === 0) {
        return false;
      }
      return true;
    } catch {
      // If table query fails, fail-closed for nearby maintenance
      return false;
    }
  }

  private normalizeQuery(query: string): string {
    return query
      .trim()
      .slice(0, 120)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[%_\\]/g, "\\$&");
  }

  private normalizeColumnSql(columnSql: SQL): SQL {
    return sql`regexp_replace(translate(lower(${columnSql}), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[\u0300-\u036f]', '', 'g')`;
  }

  private getLocationEligibilitySql(): SQL {
    return sql`(
      bl.status = 'CONFIRMED'
      AND bl.latitude IS NOT NULL
      AND bl.longitude IS NOT NULL
      AND bl.latitude >= -90.0 AND bl.latitude <= 90.0
      AND bl.longitude >= -180.0 AND bl.longitude <= 180.0
      AND (
        CASE
          WHEN (bl.source = 'GOOGLE' OR bl.google_place_id IS NOT NULL OR bl.google_reference IS NOT NULL) THEN (
            bl.source = 'GOOGLE'
            AND bl.acquired_at IS NOT NULL
            AND bl.valid_until IS NOT NULL
            AND bl.acquired_at <= NOW()
            AND bl.valid_until > NOW()
            AND bl.valid_until <= (bl.acquired_at + INTERVAL '25 days')
            AND (bl.acquired_at + INTERVAL '25 days') >= NOW()
          )
          WHEN bl.source = 'MANUAL' AND bl.google_place_id IS NULL AND bl.google_reference IS NULL THEN (
            bl.valid_until IS NULL OR bl.valid_until > NOW()
          )
          ELSE FALSE
        END
      )
    )`;
  }

  private async fetchPreviewPhotosBatch(
    shopIds: string[],
  ): Promise<Map<string, NonNullable<PublicShop["environmentMedia"]>>> {
    const photoMap = new Map<
      string,
      NonNullable<PublicShop["environmentMedia"]>
    >();
    if (!shopIds || shopIds.length === 0) return photoMap;

    try {
      const idListSql = sql.join(
        shopIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      const galleryResult = await this.database.execute(sql`
        SELECT
          bg.barbershop_id::text AS barbershop_id,
          m.id,m.public_url,m.width,m.height,m.mime_type,m.variants
        FROM barbershop_gallery bg
        INNER JOIN media m ON m.id = bg.media_id
        WHERE bg.barbershop_id IN (${idListSql})
          AND m.public_url IS NOT NULL AND m.status='READY' AND m.owner_entity_id=bg.barbershop_id
        ORDER BY bg.barbershop_id ASC, bg.is_cover DESC, bg.display_order ASC
      `);

      for (const row of galleryResult.rows) {
        const sid = String(row.barbershop_id);
        const url = String(row.public_url);
        const current = photoMap.get(sid) ?? [];
        if (current.length < 6 && !current.some((item) => item.url === url)) {
          current.push({
            id: String(row.id),
            url,
            width: Number(row.width),
            height: Number(row.height),
            mimeType: String(row.mime_type),
            posterUrl: row.variants?.thumbnail?.publicUrl,
            durationSeconds: row.variants?.main?.durationSeconds,
          });
          photoMap.set(sid, current);
        }
      }
    } catch {
      // Falha fechada / tabela ausente nao quebra busca publica
    }

    return photoMap;
  }

  private async fetchFeaturedServicesBatch(
    shopIds: string[],
  ): Promise<Map<string, any[]>> {
    const servicesMap = new Map<string, any[]>();
    if (!shopIds || shopIds.length === 0) return servicesMap;

    try {
      const idListSql = sql.join(
        shopIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      const servicesResult = await this.database.execute(sql`
        SELECT s.id,s.barbershop_id::text AS barbershop_id,s.title,s.price_in_cents,s.duration_in_minutes,
          m.public_url AS image_url,m.id AS media_id,m.width,m.height,m.mime_type,m.variants,s.featured_order
        FROM services s JOIN service_media sm ON sm.service_id=s.id JOIN media m ON m.id=sm.media_id
        WHERE s.barbershop_id IN (${idListSql}) AND s.is_featured=true AND s.is_active=true
          AND m.status='READY' AND m.purpose IN ('SERVICE_PHOTO','SERVICE_VIDEO') AND m.owner_entity_id=s.barbershop_id
        ORDER BY s.barbershop_id,s.featured_order,s.id,sm.display_order,m.id
      `);

      for (const row of servicesResult.rows) {
        const sid = String(row.barbershop_id);
        const current = servicesMap.get(sid) ?? [];
        if (current.length >= 6) continue;
        current.push({
          mediaId: String(row.media_id),
          mimeType: String(row.mime_type),
          posterUrl: row.variants?.thumbnail?.publicUrl,
          durationSeconds: row.variants?.main?.durationSeconds,
          width: Number(row.width),
          height: Number(row.height),
          id: String(row.id),
          title: String(row.title),
          priceInCents: Number(row.price_in_cents),
          durationInMinutes: Number(row.duration_in_minutes),
          imageUrl: String(row.image_url),
          featuredOrder: Number(row.featured_order ?? 0),
        });
        servicesMap.set(sid, current);
      }
    } catch {
      // Falha fechada se coluna ou tabela ausente
    }

    return servicesMap;
  }

  async rankExploreIds(input:ExploreFeedInput):Promise<string[]> {
    const conditions=[sql`b.status='ACTIVE'`];
    const hasPoint=input.mode==='NEARBY' && Boolean(input.point);
    const distance=hasPoint ? sql`2.0*6371000.0*asin(sqrt(least(1.0::double precision,greatest(0.0::double precision,power(sin(radians(bl.latitude-${input.point!.latitude}::double precision)/2.0),2)+cos(radians(${input.point!.latitude}::double precision))*cos(radians(bl.latitude))*power(sin(radians(bl.longitude-${input.point!.longitude}::double precision)/2.0),2)))))` : sql`NULL::double precision`;
    if(hasPoint)conditions.push(this.getLocationEligibilitySql());
    if(input.q?.trim()) {const term=`%${this.normalizeQuery(input.q)}%`;conditions.push(sql`(${this.normalizeColumnSql(sql`b.name`)} LIKE ${term} OR ${this.normalizeColumnSql(sql`b.location`)} LIKE ${term})`);}
    if(input.regionKey?.trim()){const region=`%${this.normalizeQuery(input.regionKey)}%`;conditions.push(sql`${this.normalizeColumnSql(sql`b.location`)} LIKE ${region}`);}
    const radius=hasPoint?sql`distance_meters<=${(input.radiusKm??10)*1000}`:sql`TRUE`;
    const quality=sql`greatest(0.0,least(1.0,(((review_count*COALESCE(rating,3.5)+35.0)/(review_count+10.0))-1.0)/4.0))`;
    const score=hasPoint?sql`0.70*exp(-distance_meters/3000.0)+0.30*${quality}`:quality;
    const result=await this.database.execute(sql`WITH candidates AS(SELECT b.id,${distance} AS distance_meters,stats.rating,stats.review_count FROM barbershops b LEFT JOIN barbershop_locations bl ON bl.barbershop_id=b.id LEFT JOIN LATERAL(SELECT AVG(rating)::double precision AS rating,COUNT(*)::int AS review_count FROM reviews WHERE barbershop_id=b.id AND status='PUBLISHED')stats ON TRUE WHERE ${sql.join(conditions,sql` AND `)}) SELECT id FROM candidates WHERE ${radius} ORDER BY ${score} DESC,distance_meters ASC NULLS LAST,review_count DESC,id ASC`);
    return result.rows.map((row:{id:string})=>String(row.id));
  }

  async search(input: DiscoveryInput): Promise<DiscoveryPage> {
    const page = Math.max(1, Number.isFinite(input.page) ? input.page : 1);
    const limit = Math.max(
      1,
      Math.min(50, Number.isFinite(input.limit) ? input.limit : 20),
    );
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
    const eligibilitySql = this.getLocationEligibilitySql();
    const conditions = [sql`b.status = 'ACTIVE'`];

    if(input.ids)conditions.push(sql`b.id=ANY(ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.ids)}::jsonb))::uuid[])`);
    if (input.regionKey?.trim()) {
      const regionTerm = `%${this.normalizeQuery(input.regionKey)}%`;
      conditions.push(
        sql`${this.normalizeColumnSql(sql`b.location`)} LIKE ${regionTerm}`,
      );
    }
    if (input.q && input.q.trim().length > 0) {
      const sanitized = this.normalizeQuery(input.q);
      const term = `%${sanitized}%`;
      const normName = this.normalizeColumnSql(sql`b.name`);
      const normLocation = this.normalizeColumnSql(sql`b.location`);
      conditions.push(
        sql`(${normName} LIKE ${term} OR ${normLocation} LIKE ${term})`,
      );
    }

    const whereClause = sql.join(conditions, sql` AND `);
    const normOrderName = this.normalizeColumnSql(sql`b.name`);

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
        b.cover_url,
        (SELECT AVG(r.rating) FROM reviews r WHERE r.barbershop_id=b.id AND r.status='PUBLISHED') AS rating,
        (SELECT COUNT(*) FROM reviews r WHERE r.barbershop_id=b.id AND r.status='PUBLISHED') AS review_count,
        b.google_maps_url,
        bl.latitude,
        bl.longitude,
        (${eligibilitySql}) AS is_eligible
      FROM barbershops b
      LEFT JOIN barbershop_locations bl ON bl.barbershop_id = b.id
      WHERE ${whereClause}
      ORDER BY ${input.ids ? sql`array_position(ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.ids)}::jsonb))::uuid[], b.id)` : normOrderName} ASC, b.id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const shopIds = rowsResult.rows.map((r: any) => String(r.id));
    const previewPhotosMap = await this.fetchPreviewPhotosBatch(shopIds);
    const featuredServicesMap = await this.fetchFeaturedServicesBatch(shopIds);

    const items: PublicShop[] = rowsResult.rows.map((row: any) => {
      const galleryPhotos = previewPhotosMap.get(String(row.id)) ?? [];
      const photos: string[] = galleryPhotos.map((photo) => photo.url);
      if (photos.length === 0 && row.cover_url) {
        photos.push(row.cover_url);
      }
      const isEligible = Boolean(row.is_eligible);
      const coordinates: GeoPoint | null =
        isEligible && row.latitude !== null && row.longitude !== null
          ? {
              latitude: Number(row.latitude),
              longitude: Number(row.longitude),
            }
          : null;

      const rawRating =
        row.rating !== null && row.rating !== undefined
          ? parseFloat(String(row.rating))
          : null;
      const reviewCount = Number(row.review_count ?? 0);
      const rating =
        rawRating !== null && !Number.isNaN(rawRating) && reviewCount > 0
          ? Number(rawRating.toFixed(2))
          : null;

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        location: row.location,
        avatarUrl: row.avatar_url ?? null,
        coverUrl: row.cover_url ?? null,
        photos,
        environmentMedia: galleryPhotos,
        rating,
        reviewCount,
        googleMapsUrl: row.google_maps_url ?? null,
        coordinates,
        distanceMeters: null,
        featuredServices: featuredServicesMap.get(String(row.id)) ?? [],
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
    const radiusMeters = radiusKm * 1000.0;
    const lat = point.latitude;
    const lon = point.longitude;

    // Conservative bounding box derivation based on R = 6,371,000m sphere
    const R = 6371000.0;
    const angularRadius = radiusMeters / R;
    // 1.5% safety margin on angular delta to guarantee conservative bounding box
    const deltaLatDegrees = ((angularRadius * 180.0) / Math.PI) * 1.015;

    const minLat = Math.max(-90.0, lat - deltaLatDegrees);
    const maxLat = Math.min(90.0, lat + deltaLatDegrees);

    const touchesPole =
      lat + deltaLatDegrees >= 89.9 || lat - deltaLatDegrees <= -89.9;

    let deltaLonDegrees: number;
    if (touchesPole) {
      deltaLonDegrees = 180.0;
    } else {
      const maxLatMag = Math.max(Math.abs(minLat), Math.abs(maxLat));
      const cosLat = Math.cos((maxLatMag * Math.PI) / 180.0);
      if (cosLat < 0.001) {
        deltaLonDegrees = 180.0;
      } else {
        deltaLonDegrees = (deltaLatDegrees / cosLat) * 1.015;
      }
    }

    // Exact spherical Haversine formula (Earth R = 6,371,000 m) with numerical clamping [0, 1]
    const haversineSql = sql`
      2.0 * 6371000.0 * asin(sqrt(
        least(1.0::double precision, greatest(0.0::double precision,
          power(sin(radians(bl.latitude - ${lat}::double precision) / 2.0), 2) +
          cos(radians(${lat}::double precision)) * cos(radians(bl.latitude)) * power(sin(radians(bl.longitude - ${lon}::double precision) / 2.0), 2)
        ))
      ))
    `;

    const eligibilitySql = this.getLocationEligibilitySql();

    const conditions = [
      sql`b.status = 'ACTIVE'`,
      sql`${eligibilitySql}`,
      sql`bl.latitude BETWEEN ${minLat}::double precision AND ${maxLat}::double precision`,
    ];

    if (deltaLonDegrees < 180.0) {
      const rawMinLon = lon - deltaLonDegrees;
      const rawMaxLon = lon + deltaLonDegrees;

      if (rawMaxLon > 180.0) {
        // Antimeridian crossing towards east (wraps to negative longitudes)
        const normMin = rawMinLon;
        const normMax = rawMaxLon - 360.0;
        conditions.push(
          sql`(bl.longitude >= ${normMin}::double precision OR bl.longitude <= ${normMax}::double precision)`,
        );
      } else if (rawMinLon < -180.0) {
        // Antimeridian crossing towards west (wraps to positive longitudes)
        const normMin = rawMinLon + 360.0;
        const normMax = rawMaxLon;
        conditions.push(
          sql`(bl.longitude >= ${normMin}::double precision OR bl.longitude <= ${normMax}::double precision)`,
        );
      } else {
        conditions.push(
          sql`bl.longitude BETWEEN ${rawMinLon}::double precision AND ${rawMaxLon}::double precision`,
        );
      }
    }

    if(input.ids)conditions.push(sql`b.id=ANY(ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.ids)}::jsonb))::uuid[])`);
    if (input.regionKey?.trim()) {
      const regionTerm = `%${this.normalizeQuery(input.regionKey)}%`;
      conditions.push(
        sql`${this.normalizeColumnSql(sql`b.location`)} LIKE ${regionTerm}`,
      );
    }
    if (input.q && input.q.trim().length > 0) {
      const sanitized = this.normalizeQuery(input.q);
      const term = `%${sanitized}%`;
      const normName = this.normalizeColumnSql(sql`b.name`);
      const normLocation = this.normalizeColumnSql(sql`b.location`);
      conditions.push(
        sql`(${normName} LIKE ${term} OR ${normLocation} LIKE ${term})`,
      );
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
        b.cover_url,
        (SELECT AVG(r.rating) FROM reviews r WHERE r.barbershop_id=b.id AND r.status='PUBLISHED') AS rating,
        (SELECT COUNT(*) FROM reviews r WHERE r.barbershop_id=b.id AND r.status='PUBLISHED') AS review_count,
        b.google_maps_url,
        bl.latitude,
        bl.longitude,
        (${haversineSql}) AS distance_meters
      FROM barbershops b
      INNER JOIN barbershop_locations bl ON bl.barbershop_id = b.id
      WHERE ${baseWhere}
        AND (${haversineSql}) <= ${radiusMeters}::double precision
      ORDER BY ${input.ids ? sql`array_position(ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.ids)}::jsonb))::uuid[], b.id)` : sql`distance_meters`} ASC, b.id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const shopIds = rowsResult.rows.map((r: any) => String(r.id));
    const previewPhotosMap = await this.fetchPreviewPhotosBatch(shopIds);
    const featuredServicesMap = await this.fetchFeaturedServicesBatch(shopIds);

    const items: PublicShop[] = rowsResult.rows.map((row: any) => {
      const galleryPhotos = previewPhotosMap.get(String(row.id)) ?? [];
      const photos: string[] = galleryPhotos.map((photo) => photo.url);
      if (photos.length === 0 && row.cover_url) {
        photos.push(row.cover_url);
      }
      const rawRating =
        row.rating !== null && row.rating !== undefined
          ? parseFloat(String(row.rating))
          : null;
      const reviewCount = Number(row.review_count ?? 0);
      const rating =
        rawRating !== null && !Number.isNaN(rawRating) && reviewCount > 0
          ? Number(rawRating.toFixed(2))
          : null;

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        location: row.location,
        avatarUrl: row.avatar_url ?? null,
        coverUrl: row.cover_url ?? null,
        photos,
        environmentMedia: galleryPhotos,
        rating,
        reviewCount,
        googleMapsUrl: row.google_maps_url ?? null,
        coordinates: {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        },
        distanceMeters: Number(row.distance_meters),
        featuredServices: featuredServicesMap.get(String(row.id)) ?? [],
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
}
