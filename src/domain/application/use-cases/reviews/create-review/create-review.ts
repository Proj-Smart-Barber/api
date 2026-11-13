import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Review } from "../../../../enterprise/entities/review";
import type { PlatformFeedback } from "../../../../enterprise/entities/platform-feedback";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import {
  resolveReviewTargetsAndFeedback,
  type ServiceRatingInput,
  type PlatformFeedbackInput,
} from "../shared/resolve-review-targets";

export interface CreateReviewDTO {
  userId: string;
  bookingId: string;
  rating: number;
  barberId?: string | null;
  barberRating?: number;
  serviceRatings?: ServiceRatingInput[];
  comment?: string;
  platformFeedback?: PlatformFeedbackInput | null;
}

export class CreateReviewUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private bookingsRepository: BookingsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
  ) {}

  async execute(
    dto: CreateReviewDTO,
  ): Promise<
    Either<
      Error,
      { review: Review; platformFeedback?: PlatformFeedback | null }
    >
  > {
    const details = await this.bookingsRepository.findByIdWithDetails(
      dto.bookingId,
    );
    const booking = details
      ? null
      : await this.bookingsRepository.findById(dto.bookingId);

    const status = details?.status ?? booking?.status;
    const customerId = details?.customerId ?? booking?.customerId;
    const barbershopIdObj = details?.barbershopId ?? booking?.barbershopId;
    const barbermanIdObj = details?.barbermanId ?? booking?.barbermanId;

    if (!details && !booking) {
      return left(new Error("Agendamento não encontrado."));
    }

    if (status !== "COMPLETED") {
      return left(
        new Error("Apenas agendamentos concluídos podem ser avaliados."),
      );
    }

    if (!customerId || customerId.toString() !== dto.userId) {
      return left(
        new Error(
          "Apenas o cliente do atendimento pode avaliar este agendamento.",
        ),
      );
    }

    if (!barbershopIdObj || !barbermanIdObj) {
      return left(
        new Error("Dados do agendamento incompletos para avaliação."),
      );
    }

    const barbershopId = barbershopIdObj.toString();
    const barbershop = await this.barbershopsRepository.findById(barbershopId);
    if (!barbershop) {
      return left(new Error("Barbearia não encontrada."));
    }

    if (barbershop.ownerId.toString() === dto.userId) {
      return left(
        new Error(
          "Proprietários e membros da equipe não podem avaliar a própria unidade.",
        ),
      );
    }

    const members =
      await this.membershipsRepository.findManyByBarbershopId(barbershopId);
    const isStaff = members.some(
      (m) => m.userId.toString() === dto.userId && m.state === "ACTIVE",
    );
    if (isStaff) {
      return left(
        new Error(
          "Proprietários e membros da equipe não podem avaliar a própria unidade.",
        ),
      );
    }

    const existingReview = await this.reviewsRepository.findByBookingId(
      dto.bookingId,
    );
    if (existingReview) {
      return left(new Error("Já existe uma avaliação para este agendamento."));
    }

    let review: Review;
    try {
      review = Review.create({
        bookingId: new UniqueEntityId(dto.bookingId),
        barbershopId: barbershopIdObj,
        customerId: new UniqueEntityId(dto.userId),
        rating: dto.rating,
        comment: dto.comment,
        status: "PUBLISHED",
      });
    } catch (validationError: unknown) {
      return left(
        validationError instanceof Error
          ? validationError
          : new Error(String(validationError)),
      );
    }

    const contractedServices = details?.services ?? [];
    const targetResolution = resolveReviewTargetsAndFeedback({
      reviewId: review.id,
      bookingId: review.bookingId,
      barbershopId: review.barbershopId,
      barbershopName: details?.barbershopName ?? barbershop.name,
      barbermanId: barbermanIdObj,
      barbermanName: details?.barbermanName,
      contractedServices,
      customerId: review.customerId,
      barbershopRating: dto.rating,
      barberId: dto.barberId,
      barberRating: dto.barberRating,
      serviceRatings: dto.serviceRatings,
      platformFeedback: dto.platformFeedback,
      now: review.createdAt,
    });

    if ("error" in targetResolution) {
      return left(targetResolution.error);
    }

    review.setItems(targetResolution.items);

    try {
      if (typeof this.reviewsRepository.createAtomic === "function") {
        await this.reviewsRepository.createAtomic(review, {
          items: targetResolution.items,
          platformFeedback: targetResolution.platformFeedback,
        });
      } else {
        await this.reviewsRepository.create(review);
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (
        errObj?.code === "23505" ||
        errObj?.message?.includes("Já existe uma avaliação") ||
        errObj?.message?.includes("unique") ||
        errObj?.message?.includes("duplicate")
      ) {
        return left(
          new Error("Já existe uma avaliação para este agendamento."),
        );
      }
      return left(err instanceof Error ? err : new Error(String(err)));
    }

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

    return right({
      review,
      platformFeedback: targetResolution.platformFeedback ?? null,
    });
  }
}
