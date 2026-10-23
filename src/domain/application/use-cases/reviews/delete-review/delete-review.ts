import { type Either, left, right } from "../../../../../core/logic/either";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";

export interface DeleteReviewDTO {
  userId: string;
  reviewId?: string;
  bookingId?: string;
  expectedVersion: number;
}

export class DeleteReviewUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private barbershopsRepository?: BarbershopsRepository,
  ) {}

  async execute(dto: DeleteReviewDTO): Promise<Either<Error, { success: boolean }>> {
    if (dto.expectedVersion === undefined || dto.expectedVersion === null) {
      return left(new Error("Versão esperada (expectedVersion) é obrigatória para exclusão."));
    }

    let review = null;
    if (dto.reviewId) {
      review = await this.reviewsRepository.findById(dto.reviewId);
    } else if (dto.bookingId) {
      review = await this.reviewsRepository.findByBookingId(dto.bookingId);
    }

    if (!review) {
      return left(new Error("Avaliação não encontrada."));
    }

    if (review.customerId.toString() !== dto.userId) {
      return left(new Error("Apenas o autor pode remover esta avaliação."));
    }

    if (review.version !== dto.expectedVersion) {
      return left(
        new Error("Conflito de versão: a avaliação foi modificada concorrentemente.")
      );
    }

    review.deleteByAuthor();
    const saved = typeof this.reviewsRepository.deleteAtomic === "function"
      ? await this.reviewsRepository.deleteAtomic(review, dto.expectedVersion)
      : await this.reviewsRepository.save(review, dto.expectedVersion);

    if (!saved) {
      return left(
        new Error("Conflito de versão: a avaliação foi modificada concorrentemente.")
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

    return right({ success: true });
  }
}
