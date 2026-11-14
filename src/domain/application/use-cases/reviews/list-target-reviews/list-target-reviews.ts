import { type Either, left, right } from "../../../../../core/logic/either";
import type { ReviewTargetType } from "../../../../enterprise/entities/review-item";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";

export interface ListTargetReviewsDTO {
  targetType: Exclude<ReviewTargetType, "BARBERSHOP">;
  targetId: string;
  barbershopId?: string;
  page?: number;
  limit?: number;
}

export interface TargetReviewListItem {
  id: string;
  rating: number;
  overallRating: number;
  targetType: Exclude<ReviewTargetType, "BARBERSHOP">;
  targetId: string;
  targetLabel: string;
  comment?: string;
  createdAt: Date;
  author: {
    name: string;
    avatarUrl?: string;
  };
}

export interface ListTargetReviewsResponse {
  targetType: Exclude<ReviewTargetType, "BARBERSHOP">;
  targetId: string;
  reviews: TargetReviewListItem[];
  total: number;
  averageRating: number | null;
  reviewCount: number;
}

export class ListTargetReviewsUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private usersRepository: UsersRepository,
    private barbershopsRepository: BarbershopsRepository,
    private servicesRepository?: ServicesRepository,
  ) {}

  async execute(
    dto: ListTargetReviewsDTO,
  ): Promise<Either<Error, ListTargetReviewsResponse>> {
    if (dto.barbershopId) {
      const shop = await this.barbershopsRepository.findById(dto.barbershopId);
      if (!shop || shop.status !== "ACTIVE") {
        return left(new Error("Barbearia não encontrada."));
      }
    }

    if (
      dto.targetType === "SERVICE" &&
      dto.barbershopId &&
      this.servicesRepository
    ) {
      const service = await this.servicesRepository.findByIdAndBarbershopId(
        dto.targetId,
        dto.barbershopId,
      );
      if (!service || !service.isActive) {
        return left(new Error("Serviço não encontrado."));
      }
    }

    if (dto.targetType === "BARBER") {
      const barber = await this.usersRepository.findById(dto.targetId);
      if (!barber) {
        return left(new Error("Profissional não encontrado."));
      }
    }

    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(50, Math.max(1, dto.limit ?? 10));

    if (!this.reviewsRepository.findManyByTarget) {
      return right({
        targetType: dto.targetType,
        targetId: dto.targetId,
        reviews: [],
        total: 0,
        averageRating: null,
        reviewCount: 0,
      });
    }

    const { entries, total, metrics } =
      await this.reviewsRepository.findManyByTarget({
        targetType: dto.targetType,
        targetId: dto.targetId,
        barbershopId: dto.barbershopId,
        page,
        limit,
      });

    const reviewsList: TargetReviewListItem[] = await Promise.all(
      entries.map(async ({ review, item }) => {
        const author = await this.usersRepository.findById(
          review.customerId.toString(),
        );
        return {
          id: review.id.toString(),
          rating: item.rating,
          overallRating: review.rating,
          targetType: dto.targetType,
          targetId: dto.targetId,
          targetLabel: item.targetLabel,
          comment: review.comment,
          createdAt: review.createdAt,
          author: {
            name: author ? author.name : "Cliente",
            avatarUrl: author?.avatarUrl,
          },
        };
      }),
    );

    return right({
      targetType: dto.targetType,
      targetId: dto.targetId,
      reviews: reviewsList,
      total,
      averageRating: metrics.averageRating,
      reviewCount: metrics.reviewCount,
    });
  }
}
