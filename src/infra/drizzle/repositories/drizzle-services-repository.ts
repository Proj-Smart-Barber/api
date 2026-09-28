import type {
  ServicesRepository,
  FindManyByBarbershopIdParams,
} from "../../../domain/application/repositories/services-repository";
import type { Service } from "../../../domain/enterprise/entities/service";
import { db } from "../index";
import { services } from "../schema";
import { inArray, eq, and, asc, sql } from "drizzle-orm";
import { DrizzleServiceMapper } from "../mappers/drizzle-service-mapper";

export class DrizzleServicesRepository implements ServicesRepository {
  async create(service: Service): Promise<void> {
    await db.insert(services).values(DrizzleServiceMapper.toDrizzle(service));
  }

  async save(service: Service): Promise<void> {
    await db
      .update(services)
      .set({
        title: service.title,
        description: service.description ?? null,
        priceInCents: service.priceInCents,
        durationInMinutes: service.durationInMinutes,
        isActive: service.isActive,
        updatedAt: service.updatedAt ?? new Date(),
      })
      .where(eq(services.id, service.id.toString()));
  }

  async findById(id: string): Promise<Service | null> {
    const results = await db.select().from(services).where(eq(services.id, id));

    const service = results[0];

    if (!service) {
      return null;
    }

    return DrizzleServiceMapper.toDomain(service);
  }

  async findByIdAndBarbershopId(
    id: string,
    barbershopId: string,
  ): Promise<Service | null> {
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.barbershopId, barbershopId)));

    if (!service) {
      return null;
    }

    return DrizzleServiceMapper.toDomain(service);
  }

  async findManyByIds(ids: string[]): Promise<Service[]> {
    if (ids.length === 0) {
      return [];
    }

    const foundServices = await db
      .select()
      .from(services)
      .where(inArray(services.id, ids));

    return foundServices.map(DrizzleServiceMapper.toDomain);
  }

  async findManyActiveByBarbershopIdAndIds(
    barbershopId: string,
    ids: string[],
  ): Promise<Service[]> {
    if (ids.length === 0) {
      return [];
    }

    const foundServices = await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.barbershopId, barbershopId),
          eq(services.isActive, true),
          inArray(services.id, ids),
        ),
      );

    return foundServices.map(DrizzleServiceMapper.toDomain);
  }

  async findManyByBarbershopId(
    barbershopId: string,
    { page, limit, includeInactive }: FindManyByBarbershopIdParams,
  ): Promise<{ services: Service[]; total: number }> {
    const conditions = [eq(services.barbershopId, barbershopId)];

    if (!includeInactive) {
      conditions.push(eq(services.isActive, true));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(services)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .select()
      .from(services)
      .where(and(...conditions))
      .orderBy(asc(services.title), asc(services.id))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      services: rows.map(DrizzleServiceMapper.toDomain),
      total,
    };
  }
}
