import { type Either, left, right } from "../../../../../core/logic/either";
import type { Review } from "../../../../enterprise/entities/review";
import type { ReviewItem } from "../../../../enterprise/entities/review-item";
import type { PlatformFeedback } from "../../../../enterprise/entities/platform-feedback";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import {
  resolveReviewTargetsAndFeedback,
  type ServiceRatingInput,
  type PlatformFeedbackInput,
} from "../shared/resolve-review-targets";

export interface UpdateReviewDTO {
  userId: string;
  reviewId?: string;
  bookingId?: string;
  rating: number;
  barberId?: string | null;
  barberRating?: number;
  serviceRatings?: ServiceRatingInput[];
  comment?: string;
  platformFeedback?: PlatformFeedbackInput | null;
  expectedVersion?: number;
}

export class UpdateReviewUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private bookingsRepository?: BookingsRepository,
  ) {}

  async execute(
    dto: UpdateReviewDTO,
  ): Promise<
    Either<
      Error,
      { review: Review; platformFeedback?: PlatformFeedback | null }
    >
  > {
    if (dto.expectedVersion === undefined) {
      return left(
        new Error("expectedVersion é obrigatória para atualizar a avaliação."),
      );
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
      return left(
        new Error("Avaliação foi removida pelo autor e não pode ser editada."),
      );
    }

    if (review.status === "HIDDEN_BY_MODERATION") {
      return left(
        new Error(
          "Esta avaliação foi ocultada pela moderação e não pode ser editada diretamente.",
        ),
      );
    }

    const hasStructuredTargets =
      dto.barberId !== undefined ||
      dto.barberRating !== undefined ||
      dto.serviceRatings !== undefined ||
      dto.platformFeedback !== undefined;

    let resolvedItems: ReviewItem[] | undefined;
    let resolvedFeedback: PlatformFeedback | null | undefined;

    if (hasStructuredTargets) {
      if (!this.bookingsRepository) {
        return left(
          new Error(
            "Não foi possível validar os alvos do agendamento para atualização.",
          ),
        );
      }

      const details = await this.bookingsRepository.findByIdWithDetails(
        review.bookingId.toString(),
      );
      if (!details) {
        return left(
          new Error("Agendamento associado à avaliação não encontrado."),
        );
      }

      const barbershop = await this.barbershopsRepository.findById(
        review.barbershopId.toString(),
      );

      const resolution = resolveReviewTargetsAndFeedback({
        reviewId: review.id,
        bookingId: review.bookingId,
        barbershopId: review.barbershopId,
        barbershopName: details.barbershopName ?? barbershop?.name,
        barbermanId: details.barbermanId,
        barbermanName: details.barbermanName,
        contractedServices: details.services,
        customerId: review.customerId,
        barbershopRating: dto.rating,
        barberId: dto.barberId,
        barberRating: dto.barberRating,
        serviceRatings: dto.serviceRatings,
        platformFeedback: dto.platformFeedback,
        now: new Date(),
      });

      if ("error" in resolution) {
        return left(resolution.error);
      }

      if (dto.barberRating !== undefined || dto.serviceRatings !== undefined) {
        resolvedItems = resolution.items;
      }
      resolvedFeedback = resolution.platformFeedback;
    }

    try {
      review.update({
        rating: dto.rating,
        comment: dto.comment,
        expectedVersion: dto.expectedVersion,
        items: resolvedItems,
      });
    } catch (err: unknown) {
      return left(err instanceof Error ? err : new Error(String(err)));
    }

    const saved =
      typeof this.reviewsRepository.updateAtomic === "function"
        ? await this.reviewsRepository.updateAtomic(
            review,
            dto.expectedVersion,
            {
              items: resolvedItems,
              platformFeedback: resolvedFeedback,
            },
          )
        : await this.reviewsRepository.save(review, dto.expectedVersion);

    if (!saved) {
      return left(
        new Error(
          "Conflito de versão: a avaliação foi modificada concorrentemente. Recarregue os dados e tente novamente.",
        ),
      );
    }

    const barbershopId = review.barbershopId.toString();
    const metrics =
      await this.reviewsRepository.calculateBarbershopRatingMetrics(
        barbershopId,
      );
    if (this.barbershopsRepository?.updateRatingMetrics) {
      await this.barbershopsRepository.updateRatingMetrics(
        barbershopId,
        metrics.averageRating,
        metrics.reviewCount,
      );
    }

    const currentFeedback =
      resolvedFeedback ??
      (this.reviewsRepository.findPlatformFeedbackByBookingId
        ? await this.reviewsRepository.findPlatformFeedbackByBookingId(
            review.bookingId.toString(),
          )
        : null);

    return right({
      review,
      platformFeedback: currentFeedback,
    });
  }
}
