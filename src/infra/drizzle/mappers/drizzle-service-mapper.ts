import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Service } from "../../../domain/enterprise/entities/service";
import type { services } from "../schema";
import type { InferSelectModel } from "drizzle-orm";

type RawService = InferSelectModel<typeof services>;

export class DrizzleServiceMapper {
  static toDomain(raw: RawService): Service {
    return Service.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        title: raw.title,
        description: raw.description ?? undefined,
        imageUrl: raw.imageUrl ?? undefined,
        isFeatured: raw.isFeatured ?? false,
        featuredOrder: raw.featuredOrder ?? 0,
        priceInCents: raw.priceInCents,
        durationInMinutes: raw.durationInMinutes,
        isActive: raw.isActive,
        rating: raw.rating ? Number(parseFloat(raw.rating).toFixed(2)) : 0,
        reviewCount: raw.reviewCount ?? 0,
        createdAt: raw.createdAt ?? undefined,
        updatedAt: raw.updatedAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(service: Service) {
    return {
      id: service.id.toString(),
      barbershopId: service.barbershopId.toString(),
      title: service.title,
      description: service.description ?? null,
      imageUrl: service.imageUrl ?? null,
      isFeatured: service.isFeatured ?? false,
      featuredOrder: service.featuredOrder ?? 0,
      priceInCents: service.priceInCents,
      durationInMinutes: service.durationInMinutes,
      isActive: service.isActive,
      rating: service.rating.toFixed(2),
      reviewCount: service.reviewCount,
      createdAt: service.createdAt ?? new Date(),
      updatedAt: service.updatedAt ?? new Date(),
    };
  }

  static toHTTP(service: Service) {
    const reviewCount = service.reviewCount ?? 0;
    return {
      ...DrizzleServiceMapper.toDrizzle(service),
      rating: reviewCount > 0 ? Number(service.rating.toFixed(2)) : null,
      reviewCount,
    };
  }
}
