import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Review } from "../../../../enterprise/entities/review";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";

export interface CreateReviewDTO {
  userId: string;
  bookingId: string;
  rating: number;
  comment?: string;
}

export class CreateReviewUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private bookingsRepository: BookingsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
  ) {}

  async execute(dto: CreateReviewDTO): Promise<Either<Error, { review: Review }>> {
    const booking = await this.bookingsRepository.findById(dto.bookingId);
    if (!booking) {
      return left(new Error("Agendamento não encontrado."));
    }

    if (booking.status !== "COMPLETED") {
      return left(new Error("Apenas agendamentos concluídos podem ser avaliados."));
    }

    if (!booking.customerId || booking.customerId.toString() !== dto.userId) {
      return left(new Error("Apenas o cliente do atendimento pode avaliar este agendamento."));
    }

    const barbershopId = booking.barbershopId.toString();
    const barbershop = await this.barbershopsRepository.findById(barbershopId);
    if (!barbershop) {
      return left(new Error("Barbearia não encontrada."));
    }

    if (barbershop.ownerId.toString() === dto.userId) {
      return left(new Error("Proprietários e membros da equipe não podem avaliar a própria unidade."));
    }

    const members = await this.membershipsRepository.findManyByBarbershopId(barbershopId);
    const isStaff = members.some(
      (m) => m.userId.toString() === dto.userId && m.state === "ACTIVE"
    );
    if (isStaff) {
      return left(new Error("Proprietários e membros da equipe não podem avaliar a própria unidade."));
    }

    const existingReview = await this.reviewsRepository.findByBookingId(dto.bookingId);
    if (existingReview) {
      return left(new Error("Já existe uma avaliação para este agendamento."));
    }

    let review: Review;
    try {
      review = Review.create({
        bookingId: new UniqueEntityId(dto.bookingId),
        barbershopId: booking.barbershopId,
        customerId: new UniqueEntityId(dto.userId),
        rating: dto.rating,
        comment: dto.comment,
        status: "PUBLISHED",
      });
    } catch (validationError: any) {
      return left(new Error(validationError.message));
    }

    try {
      if (typeof this.reviewsRepository.createAtomic === "function") {
        await this.reviewsRepository.createAtomic(review);
      } else {
        await this.reviewsRepository.create(review);
      }
    } catch (err: any) {
      if (
        err?.code === "23505" ||
        err?.message?.includes("Já existe uma avaliação") ||
        err?.message?.includes("unique") ||
        err?.message?.includes("duplicate")
      ) {
        return left(new Error("Já existe uma avaliação para este agendamento."));
      }
      return left(err instanceof Error ? err : new Error(String(err)));
    }

    // Sincroniza métricas no repositório de barbearias em memória quando injetado
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
