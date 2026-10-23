import { type Either, right } from "../../../../../core/logic/either";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import type { UsersRepository } from "../../../repositories/users-repository";

export interface ListBarbershopReviewsDTO {
  barbershopId: string;
  page?: number;
  limit?: number;
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

  async execute(dto: ListBarbershopReviewsDTO): Promise<Either<Error, ListBarbershopReviewsResponse>> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(50, Math.max(1, dto.limit ?? 10));

    const { reviews, total } = await this.reviewsRepository.findManyByBarbershopId(
      dto.barbershopId,
      { page, limit }
    );

    const metrics = await this.reviewsRepository.getBarbershopRatingMetrics(
      dto.barbershopId
    );

    // Enriquecer com dados públicos do autor (sem expor bookingId ou IDs privados)
    const enrichedReviews: EnrichedReviewItem[] = await Promise.all(
      reviews.map(async (review) => {
        const user = await this.usersRepository.findById(review.customerId.toString());
        return {
          id: review.id.toString(),
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          author: {
            name: user ? user.name : "Cliente",
            avatarUrl: user?.avatarUrl,
          },
        };
      })
    );

    return right({
      reviews: enrichedReviews,
      total,
      averageRating: metrics.averageRating,
      reviewCount: metrics.reviewCount,
    });
  }
}
