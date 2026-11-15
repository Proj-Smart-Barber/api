import type {
  ServicesRepository,
  FindManyByBarbershopIdParams,
} from "../../../domain/application/repositories/services-repository";
import type { Service } from "../../../domain/enterprise/entities/service";
import { db } from "../index";
import { services, reviewItems, reviews } from "../schema";
import { inArray, eq, and, asc, sql } from "drizzle-orm";
import { DrizzleServiceMapper } from "../mappers/drizzle-service-mapper";

export class DrizzleServicesRepository implements ServicesRepository {
  private customDb?: any;

  constructor(customDb?: any) {
    this.customDb = customDb;
  }

  private get database() {
    return this.customDb ?? db;
  }

  private async enrichServicesWithCanonicalRatings(
    servicesList: Service[],
  ): Promise<void> {
    if (servicesList.length === 0) {
      return;
    }

    const serviceIds = servicesList.map((s) => s.id.toString());

    const stats = await this.database
      .select({
        serviceId: reviewItems.targetId,
        avgRating: sql<string>`AVG(${reviewItems.rating})::numeric(10,2)`,
        count: sql<number>`COUNT(${reviewItems.id})::int`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(
        and(
          eq(reviewItems.targetType, "SERVICE"),
          inArray(reviewItems.targetId, serviceIds),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .groupBy(reviewItems.targetId);

    const statsMap = new Map<string, { rating: number; count: number }>();
    for (const row of stats) {
      if (!row.serviceId) continue;
      const count = Number(row.count ?? 0);
      const rawRating = row.avgRating ? parseFloat(String(row.avgRating)) : 0;
      const rating =
        count > 0 && !Number.isNaN(rawRating)
          ? Number(rawRating.toFixed(2))
          : 0;
      statsMap.set(row.serviceId, { rating, count });
    }

    for (const service of servicesList) {
      const metric = statsMap.get(service.id.toString());
      if (metric) {
        service.updateRatingMetrics(metric.rating, metric.count);
      } else {
        service.updateRatingMetrics(0, 0);
      }
    }
  }

  async create(service: Service): Promise<void> {
    await this.database
      .insert(services)
      .values(DrizzleServiceMapper.toDrizzle(service));
  }

  async save(service: Service): Promise<void> {
    await this.database
      .update(services)
      .set({
        title: service.title,
        description: service.description ?? null,
        imageUrl: service.imageUrl ?? null,
        isFeatured: service.isFeatured ?? false,
        featuredOrder: service.featuredOrder ?? 0,
        priceInCents: service.priceInCents,
        durationInMinutes: service.durationInMinutes,
        isActive: service.isActive,
        updatedAt: service.updatedAt ?? new Date(),
      })
      .where(eq(services.id, service.id.toString()));
  }

  async findById(id: string): Promise<Service | null> {
    const results = await this.database
      .select()
      .from(services)
      .where(eq(services.id, id));

    const serviceRow = results[0];

    if (!serviceRow) {
      return null;
    }

    const service = DrizzleServiceMapper.toDomain(serviceRow);
    await this.enrichServicesWithCanonicalRatings([service]);
    return service;
  }

  async findByIdAndBarbershopId(
    id: string,
    barbershopId: string,
  ): Promise<Service | null> {
    const [serviceRow] = await this.database
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.barbershopId, barbershopId)));

    if (!serviceRow) {
      return null;
    }

    const service = DrizzleServiceMapper.toDomain(serviceRow);
    await this.enrichServicesWithCanonicalRatings([service]);
    return service;
  }

  async findManyByIds(ids: string[]): Promise<Service[]> {
    if (ids.length === 0) {
      return [];
    }

    const foundServices = await this.database
      .select()
      .from(services)
      .where(inArray(services.id, ids));

    const domainServices = foundServices.map(DrizzleServiceMapper.toDomain);
    await this.enrichServicesWithCanonicalRatings(domainServices);
    return domainServices;
  }

  async findManyActiveByBarbershopIdAndIds(
    barbershopId: string,
    ids: string[],
  ): Promise<Service[]> {
    if (ids.length === 0) {
      return [];
    }

    const foundServices = await this.database
      .select()
      .from(services)
      .where(
        and(
          eq(services.barbershopId, barbershopId),
          eq(services.isActive, true),
          inArray(services.id, ids),
        ),
      );

    const domainServices = foundServices.map(DrizzleServiceMapper.toDomain);
    await this.enrichServicesWithCanonicalRatings(domainServices);
    return domainServices;
  }

  async findManyByBarbershopId(
    barbershopId: string,
    { page, limit, includeInactive }: FindManyByBarbershopIdParams,
  ): Promise<{ services: Service[]; total: number }> {
    const conditions = [eq(services.barbershopId, barbershopId)];

    if (!includeInactive) {
      conditions.push(eq(services.isActive, true));
    }

    const [countResult] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(services)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);

    const rows = await this.database
      .select()
      .from(services)
      .where(and(...conditions))
      .orderBy(asc(services.title), asc(services.id))
      .limit(limit)
      .offset((page - 1) * limit);

    const domainServices = rows.map(DrizzleServiceMapper.toDomain);
    await this.enrichServicesWithCanonicalRatings(domainServices);

    return {
      services: domainServices,
      total,
    };
  }
}
