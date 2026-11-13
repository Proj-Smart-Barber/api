import { type Either, right } from "../../../../../core/logic/either";
import type { ReviewItem } from "../../../../enterprise/entities/review-item";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { UsersRepository } from "../../../repositories/users-repository";

export interface ListBarbershopReviewsDTO {
  barbershopId: string;
  page?: number;
  limit?: number;
}

export interface ReviewTargetSummaryDTO {
  targetType: "BARBERSHOP" | "BARBER" | "SERVICE";
  targetId: string | null;
  targetLabel: string;
  rating: number;
}

export interface EnrichedReviewItem {
  id: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  author: {
    name: string;
    avatarUrl?: string;
  };
  targets?: ReviewTargetSummaryDTO[];
}

export interface ListBarbershopReviewsResponse {
  reviews: EnrichedReviewItem[];
  total: number;
  averageRating: number;
  reviewCount: number;
}

export class ListBarbershopReviewsUseCase {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute(
    dto: ListBarbershopReviewsDTO,
  ): Promise<Either<Error, ListBarbershopReviewsResponse>> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(50, Math.max(1, dto.limit ?? 10));

    const { reviews, total } =
      await this.reviewsRepository.findManyByBarbershopId(dto.barbershopId, {
        page,
        limit,
      });

    const metrics = await this.reviewsRepository.getBarbershopRatingMetrics(
      dto.barbershopId,
    );

    const itemsMap =
      reviews.length > 0 && this.reviewsRepository.findItemsByReviewIds
        ? await this.reviewsRepository.findItemsByReviewIds(
            reviews.map((r) => r.id.toString()),
          )
        : new Map<string, ReviewItem[]>();

    const enrichedReviews: EnrichedReviewItem[] = await Promise.all(
      reviews.map(async (review) => {
        const user = await this.usersRepository.findById(
          review.customerId.toString(),
        );
        const items: ReviewItem[] =
          itemsMap.get(review.id.toString()) ?? review.items;
        return {
          id: review.id.toString(),
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          author: {
            name: user ? user.name : "Cliente",
            avatarUrl: user?.avatarUrl,
          },
          targets: items.map((item) => ({
            targetType: item.targetType,
            targetId: item.targetId?.toString() ?? null,
            targetLabel: item.targetLabel,
            rating: item.rating,
          })),
        };
      }),
    );

    return right({
      reviews: enrichedReviews,
      total,
      averageRating: metrics.averageRating,
      reviewCount: metrics.reviewCount,
    });
  }
}
