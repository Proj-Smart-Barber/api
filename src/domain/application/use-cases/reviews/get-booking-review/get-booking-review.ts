import { type Either, left, right } from "../../../../../core/logic/either";
import { Review } from "../../../../enterprise/entities/review";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";

export interface GetBookingReviewDTO {
  bookingId: string;
  userId?: string;
  isPlatformAdmin?: boolean;
}

export class GetBookingReviewUseCase {
  constructor(private reviewsRepository: ReviewsRepository) {}

  async execute(dto: GetBookingReviewDTO): Promise<Either<Error, { review: Review | null }>> {
    if (!dto.userId && !dto.isPlatformAdmin) {
      return left(new Error("Autenticação necessária para consultar a avaliação desta reserva."));
    }

    const review = await this.reviewsRepository.findByBookingId(dto.bookingId);
    if (!review) {
      return right({ review: null });
    }

    // Verify customer beneficiary authorization
    if (dto.userId && review.customerId.toString() !== dto.userId && !dto.isPlatformAdmin) {
      return left(new Error("Não autorizado a consultar a avaliação desta reserva."));
    }

    // Never expose raw comment if hidden by moderation to non-admin actors
    if (review.status === "HIDDEN_BY_MODERATION" && !dto.isPlatformAdmin) {
      const sanitized = Review.create(
        {
          bookingId: review.bookingId,
          barbershopId: review.barbershopId,
          customerId: review.customerId,
          rating: review.rating,
          comment: undefined,
          status: review.status,
          version: review.version,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        },
        review.id
      );
      return right({ review: sanitized });
    }

    return right({ review });
  }
}
