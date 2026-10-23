import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { MediaRepository } from "../../../repositories/media-repository";

export interface UpdateUserAvatarDTO {
  userId: string;
  mediaId: string;
}

export interface UpdateUserAvatarResponse {
  avatarUrl: string;
}

export class UpdateUserAvatarUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private mediaRepository: MediaRepository
  ) {}

  async execute(dto: UpdateUserAvatarDTO): Promise<Either<Error, UpdateUserAvatarResponse>> {
    const user = await this.usersRepository.findById(dto.userId);
    if (!user) {
      return left(new Error("Usuário não encontrado."));
    }

    const media = await this.mediaRepository.findById(dto.mediaId);
    if (!media) {
      return left(new Error("Mídia não encontrada."));
    }

    if (!media.isOwnedBy(user.id)) {
      return left(new Error("Mídia não pertence ao usuário autenticado."));
    }

    if (media.purpose !== "USER_AVATAR") {
      return left(new Error("A mídia informada não foi designada para avatar de usuário."));
    }

    if (!media.isReady()) {
      return left(new Error("A mídia ainda não está pronta para associação. Confirme o upload antes."));
    }

    user.avatarUrl = media.publicUrl;
    await this.usersRepository.update(user);

    return right({ avatarUrl: media.publicUrl });
  }
}
