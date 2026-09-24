import type { ServicesRepository } from "../../../domain/application/repositories/services-repository";
import type { Service } from "../../../domain/enterprise/entities/service";
import { db } from "../index";
import { services } from "../schema";
import { inArray, eq } from "drizzle-orm";
import { DrizzleServiceMapper } from "../mappers/drizzle-service-mapper";

export class DrizzleServicesRepository implements ServicesRepository {
  async findById(id: string): Promise<Service | null> {
    const results = await db.select().from(services).where(eq(services.id, id));

    const service = results[0];

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
}
