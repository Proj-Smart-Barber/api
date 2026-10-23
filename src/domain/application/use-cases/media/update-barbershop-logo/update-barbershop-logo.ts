import { type Either, left, right } from "../../../../../core/logic/either";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { MediaRepository } from "../../../repositories/media-repository";

export interface UpdateBarbershopLogoDTO {
  userId: string;
  barbershopId: string;
  mediaId?: string | null;
}

export class UpdateBarbershopLogoUseCase {
  constructor(
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

  async execute(dto: UpdateBarbershopLogoDTO): Promise<Either<Error, { avatarUrl?: string }>> {
    const isOwner = await this.verifyOwner(dto.userId, dto.barbershopId);
    if (!isOwner) {
      return left(new Error("Apenas o proprietário ativo da unidade pode alterar o logo da barbearia."));
    }

    const shop = await this.barbershopsRepository.findById(dto.barbershopId);
    if (!shop) {
      return left(new Error("Barbearia não encontrada."));
    }

    if (dto.mediaId) {
      const media = await this.mediaRepository.findById(dto.mediaId);
      if (!media) {
        return left(new Error("Mídia não encontrada."));
      }

      if (!media.isReady()) {
        return left(new Error("A mídia ainda não está pronta para associação."));
      }

      if (media.purpose !== "BARBERSHOP_LOGO") {
        return left(new Error("A mídia não foi designada para logo da barbearia."));
      }

      // Previne associação cruzada entre unidades diferentes (R06)
      if (media.ownerEntityId && media.ownerEntityId.toString() !== dto.barbershopId) {
        return left(new Error("Mídia pertence a outra unidade e não pode ser associada a esta barbearia."));
      }

      // Verify media belongs to an active owner of this barbershop or the actor
      const members = await this.membershipsRepository.findManyByBarbershopId(dto.barbershopId);
      const isMediaOwnerAuthorized =
        media.ownerId.toString() === dto.userId ||
        members.some(
          (m) => m.userId.toString() === media.ownerId.toString() && m.role === Role.OWNER && m.state === "ACTIVE"
        );
      if (!isMediaOwnerAuthorized) {
        return left(new Error("Mídia pertence a outro usuário sem vínculo ativo nesta unidade."));
      }

      shop.avatarUrl = media.publicUrl;
    } else {
      shop.avatarUrl = undefined;
    }

    await this.barbershopsRepository.save(shop);

    return right({ avatarUrl: shop.avatarUrl });
  }
}
