import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ReviewModerationLog } from "../../../../enterprise/entities/review-moderation-log";
import type { Review } from "../../../../enterprise/entities/review";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";

export interface ModerateReviewDTO {
  adminUserId: string;
  reviewId: string;
  action: "HIDE" | "RESTORE";
  note?: string;
  expectedVersion: number;
}

export class ModerateReviewUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private usersRepository: UsersRepository,
    private barbershopsRepository?: BarbershopsRepository,
  ) {}

  async execute(dto: ModerateReviewDTO): Promise<Either<Error, { review: Review }>> {
    if (dto.expectedVersion === undefined || dto.expectedVersion === null) {
      return left(new Error("Versão esperada (expectedVersion) é obrigatória para moderação."));
    }

    const adminUser = await this.usersRepository.findById(dto.adminUserId);
    if (!adminUser || adminUser.accountType !== "PLATFORM_ADMIN") {
      return left(new Error("Apenas administradores da plataforma podem moderar avaliações."));
    }

    const review = await this.reviewsRepository.findById(dto.reviewId);
    if (!review) {
      return left(new Error("Avaliação não encontrada."));
    }

    const reason = dto.note?.trim();
    if (!reason || reason.length < 3) {
      return left(new Error("Motivo da moderação é obrigatório."));
    }

    if (review.version !== dto.expectedVersion) {
      return left(
        new Error("Conflito de versão: a avaliação foi modificada concorrentemente.")
      );
    }

    if (dto.action === "HIDE") {
      review.hideByModeration();
    } else if (dto.action === "RESTORE") {
      try {
        review.restoreByModeration();
      } catch (err: any) {
        return left(new Error(err.message));
      }
    }

    const log = ReviewModerationLog.create({
      reviewId: new UniqueEntityId(dto.reviewId),
      adminId: new UniqueEntityId(dto.adminUserId),
      action: dto.action,
      reason,
    });

    if (this.reviewsRepository.moderateReview) {
      const success = await this.reviewsRepository.moderateReview(
        review,
        log,
        dto.expectedVersion
      );
      if (!success) {
        return left(
          new Error("Conflito de versão: a avaliação foi modificada concorrentemente.")
        );
      }
    } else {
      const saved = await this.reviewsRepository.save(review, dto.expectedVersion);
      if (!saved) {
        return left(
          new Error("Conflito de versão: a avaliação foi modificada concorrentemente.")
        );
      }
      await this.reviewsRepository.createModerationLog(log);
    }

    const metrics = await this.reviewsRepository.calculateBarbershopRatingMetrics(
      review.barbershopId.toString()
    );
    if (this.barbershopsRepository?.updateRatingMetrics) {
      await this.barbershopsRepository.updateRatingMetrics(
        review.barbershopId.toString(),
        metrics.averageRating,
        metrics.reviewCount
      );
    }

    return right({ review });
  }
}
