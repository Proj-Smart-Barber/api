import type { BarbershopsRepository } from "@/domain/application/repositories/barbershops-repository";
import type { Barbershop } from "@/domain/enterprise/entities/barbershop";
import { db } from "../index";
import { barbershops } from "../schema";
import { eq } from "drizzle-orm";
import { DrizzleBarbershopMapper } from "../mappers/drizzle-barbershop-mapper";

export class DrizzleBarbershopsRepository implements BarbershopsRepository {
  async findById(id: string): Promise<Barbershop | null> {
    const results = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, id));

    const barbershop = results[0];

    if (!barbershop) {
      return null;
    }

    return DrizzleBarbershopMapper.toDomain(barbershop);
  }
}
