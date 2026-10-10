import { eq } from "drizzle-orm";
import type { ServiceItemsRepository } from "../../../domain/application/repositories/service-items-repository";
import type { ServiceItem } from "../../../domain/enterprise/entities/service-item";
import { ServiceItemMapper } from "../../../domain/enterprise/mappers/service-item-mapper";
import { db } from "../index";
import { serviceItems } from "../schema";

export class DrizzleServiceItemsRepository implements ServiceItemsRepository {
  async create(serviceItem: ServiceItem): Promise<void> {
    const data = ServiceItemMapper.toPersistence(serviceItem);
    await db.insert(serviceItems).values(data);
  }

  async findById(id: string): Promise<ServiceItem | null> {
    const [result] = await db
      .select()
      .from(serviceItems)
      .where(eq(serviceItems.id, id));

    if (!result) return null;

    return ServiceItemMapper.toDomain(result);
  }

  async deleteById(id: string): Promise<void> {
    await db.delete(serviceItems).where(eq(serviceItems.id, id));
  }
}
