import { type Either, left, right } from "../../../../../core/logic/either";
import type { Review } from "../../../../enterprise/entities/review";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";

export interface UpdateReviewDTO {
  userId: string;
  reviewId?: string;
  bookingId?: string;
  rating: number;
  comment?: string;
  expectedVersion?: number;
}

export class UpdateReviewUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute(dto: UpdateReviewDTO): Promise<Either<Error, { review: Review }>> {
    if (dto.expectedVersion === undefined) {
      return left(new Error("expectedVersion é obrigatória para atualizar a avaliação."));
    }

    let review: Review | null = null;

    if (dto.reviewId) {
      review = await this.reviewsRepository.findById(dto.reviewId);
    } else if (dto.bookingId) {
      review = await this.reviewsRepository.findByBookingId(dto.bookingId);
    }

    if (!review) {
      return left(new Error("Avaliação não encontrada."));
    }

    if (review.customerId.toString() !== dto.userId) {
      return left(new Error("Apenas o autor pode editar esta avaliação."));
    }

    if (review.status === "DELETED_BY_AUTHOR") {
      return left(new Error("Avaliação foi removida pelo autor e não pode ser editada."));
    }

    if (review.status === "HIDDEN_BY_MODERATION") {
      return left(new Error("Esta avaliação foi ocultada pela moderação e não pode ser editada diretamente."));
    }

    try {
      review.update({
        rating: dto.rating,
        comment: dto.comment,
        expectedVersion: dto.expectedVersion,
      });
    } catch (err: any) {
      return left(new Error(err.message));
    }

    const saved = typeof this.reviewsRepository.updateAtomic === "function"
      ? await this.reviewsRepository.updateAtomic(review, dto.expectedVersion)
      : await this.reviewsRepository.save(review, dto.expectedVersion);

    if (!saved) {
      return left(
        new Error(
          "Conflito de versão: a avaliação foi modificada concorrentemente. Recarregue os dados e tente novamente."
        )
      );
    }

    const barbershopId = review.barbershopId.toString();
    const metrics = await this.reviewsRepository.calculateBarbershopRatingMetrics(barbershopId);
    if (this.barbershopsRepository?.updateRatingMetrics) {
      await this.barbershopsRepository.updateRatingMetrics(
        barbershopId,
        metrics.averageRating,
        metrics.reviewCount
      );
    }

    return right({ review });
  }
}
