// biome-ignore lint/complexity/noStaticOnlyClass: Domain mapper pattern
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { BarbershopGalleryItem } from "../entities/barbershop-gallery-item";

export class BarbershopGalleryMapper {
  static toDomain(raw: any): BarbershopGalleryItem {
    return BarbershopGalleryItem.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId ?? raw.barbershop_id),
        mediaId: new UniqueEntityId(raw.mediaId ?? raw.media_id),
        displayOrder: raw.displayOrder ?? raw.display_order ?? 0,
        caption: raw.caption ?? undefined,
        isCover: raw.isCover ?? raw.is_cover ?? false,
        publicUrl: raw.publicUrl ?? raw.public_url ?? undefined,
        createdAt: new Date(raw.createdAt ?? raw.created_at),
        updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
      },
      new UniqueEntityId(raw.id)
    );
  }

  static toPersistence(item: BarbershopGalleryItem): any {
    return {
      id: item.id.toString(),
      barbershopId: item.barbershopId.toString(),
      mediaId: item.mediaId.toString(),
      displayOrder: item.displayOrder,
      caption: item.caption ?? null,
      isCover: item.isCover,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
