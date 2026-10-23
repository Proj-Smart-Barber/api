import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { BarbershopGalleryItem } from "../../../../enterprise/entities/barbershop-gallery-item";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopGalleryRepository } from "../../../repositories/barbershop-gallery-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { MediaRepository } from "../../../repositories/media-repository";

export interface ReorderGalleryDTO {
  userId: string;
  barbershopId: string;
  itemIds?: string[];
  mediaIds?: string[];
}

export class ManageBarbershopGalleryUseCase {
  private readonly MAX_GALLERY_PHOTOS = 10;

  constructor(
    private galleryRepository: BarbershopGalleryRepository,
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
    private mediaRepository: MediaRepository
  ) {}

  private async verifyOwner(userId: string, barbershopId: string): Promise<boolean> {
    const shop = await this.barbershopsRepository.findById(barbershopId);
    if (!shop) return false;

    // Strict active OWNER check (no bypass on shop.ownerId)
    const members = await this.membershipsRepository.findManyByBarbershopId(barbershopId);
    const activeOwner = members.find(
      (m) => m.userId.toString() === userId && m.role === Role.OWNER && m.state === "ACTIVE"
    );
    return !!activeOwner;
  }

  async addPhoto(dto: {
    userId: string;
    barbershopId: string;
    mediaId: string;
    caption?: string;
    isCover?: boolean;
  }): Promise<Either<Error, { item: BarbershopGalleryItem }>> {
    const isOwner = await this.verifyOwner(dto.userId, dto.barbershopId);
    if (!isOwner) {
      return left(new Error("Apenas o proprietário ativo da unidade pode gerenciar a galeria."));
    }

    // 1. Find media
    const media = await this.mediaRepository.findById(dto.mediaId);
    if (!media) {
      return left(new Error("Mídia não encontrada."));
    }

    if (!media.isReady()) {
      return left(new Error("A mídia ainda não está pronta para inclusão na galeria."));
    }

    if (media.purpose !== "BARBERSHOP_GALLERY" && media.purpose !== "BARBERSHOP_COVER") {
      return left(new Error("Finalidade da mídia incompatível com a galeria da barbearia."));
    }

    // Previne associação cruzada entre unidades diferentes (R06 / A01)
    if (media.ownerEntityId && media.ownerEntityId.toString() !== dto.barbershopId) {
      return left(new Error("Mídia pertence a outra unidade e não pode ser adicionada a esta galeria."));
    }

    // 2. Verify media ownership / authorized tenant
    const members = await this.membershipsRepository.findManyByBarbershopId(dto.barbershopId);
    const isMediaOwnerAuthorized =
      media.ownerId.toString() === dto.userId ||
      members.some(
        (m) => m.userId.toString() === media.ownerId.toString() && m.role === Role.OWNER && m.state === "ACTIVE"
      );
    if (!isMediaOwnerAuthorized) {
      return left(new Error("Mídia pertence a outro usuário sem vínculo ativo nesta unidade."));
    }

    // 3. Adição atômica coordenada no banco de dados (A01)
    const result = await this.galleryRepository.addPhotoAtomic({
      barbershopId: dto.barbershopId,
      mediaId: dto.mediaId,
      caption: dto.caption,
      isCover: dto.isCover,
      publicUrl: media.publicUrl,
      maxPhotos: this.MAX_GALLERY_PHOTOS,
    });

    if (!result.success) {
      return left(
        new Error(`Limite máximo de ${this.MAX_GALLERY_PHOTOS} fotos na galeria atingido.`)
      );
    }

    return right({ item: result.item });
  }

  async removePhoto(dto: {
    userId: string;
    barbershopId: string;
    mediaId?: string;
    galleryItemId?: string;
  }): Promise<Either<Error, { success: boolean }>> {
    const isOwner = await this.verifyOwner(dto.userId, dto.barbershopId);
    if (!isOwner) {
      return left(new Error("Apenas o proprietário ativo da unidade pode gerenciar a galeria."));
    }

    const targetId = dto.galleryItemId || dto.mediaId;
    if (!targetId) {
      return left(new Error("Identificador do item da galeria não informado."));
    }

    const result = await this.galleryRepository.removePhotoAtomic({
      barbershopId: dto.barbershopId,
      galleryItemId: targetId,
    });

    if (!result.success) {
      return left(new Error("Item da galeria não encontrado."));
    }

    return right({ success: true });
  }

  async reorder(dto: ReorderGalleryDTO): Promise<Either<Error, { success: boolean }>> {
    const isOwner = await this.verifyOwner(dto.userId, dto.barbershopId);
    if (!isOwner) {
      return left(new Error("Apenas o proprietário ativo da unidade pode gerenciar a galeria."));
    }

    const items = await this.galleryRepository.findByBarbershopId(dto.barbershopId);
    const itemMapById = new Map(items.map((i) => [i.id.toString(), i]));
    const itemMapByMediaId = new Map(items.map((i) => [i.mediaId.toString(), i]));

    const ids = dto.itemIds || dto.mediaIds || [];
    if (ids.length !== items.length) {
      return left(
        new Error("A lista de reordenação deve conter exatamente todos os itens da galeria.")
      );
    }

    const itemIdsToOrder: string[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      const item = itemMapById.get(id) || itemMapByMediaId.get(id);
      if (!item) {
        return left(new Error(`Item '${id}' não pertence a esta barbearia.`));
      }
      if (seen.has(item.id.toString())) {
        return left(new Error("Lista de reordenação contém itens duplicados."));
      }
      seen.add(item.id.toString());
      itemIdsToOrder.push(item.id.toString());
    }

    await this.galleryRepository.reorderPhotosAtomic({
      barbershopId: dto.barbershopId,
      itemIds: itemIdsToOrder,
    });

    return right({ success: true });
  }

  async setCover(dto: {
    userId: string;
    barbershopId: string;
    mediaId?: string;
    galleryItemId?: string;
  }): Promise<Either<Error, { success: boolean }>> {
    const isOwner = await this.verifyOwner(dto.userId, dto.barbershopId);
    if (!isOwner) {
      return left(new Error("Apenas o proprietário ativo da unidade pode gerenciar a galeria."));
    }

    const items = await this.galleryRepository.findByBarbershopId(dto.barbershopId);
    const targetId = dto.galleryItemId || dto.mediaId;
    const targetItem = items.find(
      (i) => i.id.toString() === targetId || i.mediaId.toString() === targetId
    );
    if (!targetItem) {
      return left(new Error("Item da galeria não encontrado."));
    }

    const media = await this.mediaRepository.findById(targetItem.mediaId.toString());

    const success = await this.galleryRepository.setCoverPhotoAtomic({
      barbershopId: dto.barbershopId,
      galleryItemId: targetItem.id.toString(),
      publicUrl: media?.publicUrl ?? targetItem.publicUrl ?? "",
    });

    if (!success) {
      return left(new Error("Não foi possível definir a foto de capa."));
    }

    return right({ success: true });
  }

  async listPhotos(dto: {
    barbershopId: string;
  }): Promise<Either<Error, { items: BarbershopGalleryItem[] }>> {
    const items = await this.galleryRepository.findByBarbershopId(dto.barbershopId);
    return right({ items });
  }
}
