import { Barbershop } from "@/domain/enterprise/entities/barbershop";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { Slug } from "@/domain/enterprise/entities/value-objects/slug";

export class DrizzleBarbershopMapper {
  static toDomain(raw: any): Barbershop {
    return Barbershop.create(
      {
        name: raw.name,
        ownerId: new UniqueEntityId(raw.ownerId),
        slug: Slug.create(raw.slug),
        cnpj: raw.cnpj,
        location: raw.location,
        timezone: raw.timezone,
        status: raw.status,
        avatarUrl: raw.avatarUrl,
        createdAt: raw.createdAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(barbershop: Barbershop) {
    return {
      id: barbershop.id.toString(),
      name: barbershop.name,
      ownerId: barbershop.ownerId.toString(),
      slug: barbershop.slug.value,
      cnpj: barbershop.cnpj,
      location: barbershop.location,
      timezone: barbershop.timezone,
      status: barbershop.status,
      avatarUrl: barbershop.avatarUrl,
      createdAt: barbershop.createdAt,
    };
  }
}
