import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import type { Media } from "../../../../enterprise/entities/media";
import type { MediaRepository } from "../../../repositories/media-repository";

export interface GetMediaStatusDTO {
  userId: string;
  mediaId: string;
}

export interface GetMediaStatusResponse {
  media: Media;
}

export class GetMediaStatusUseCase {
  constructor(private mediaRepository: MediaRepository) {}

  async execute(dto: GetMediaStatusDTO): Promise<Either<Error, GetMediaStatusResponse>> {
    const media = await this.mediaRepository.findById(dto.mediaId);
    if (!media) {
      return left(new Error("Mídia não encontrada."));
    }

    if (!media.isOwnedBy(new UniqueEntityId(dto.userId))) {
      return left(new Error("Não autorizado a consultar esta mídia."));
    }

    return right({ media });
  }
}
