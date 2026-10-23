import type { Review } from "../../enterprise/entities/review";
import type { ReviewReport } from "../../enterprise/entities/review-report";
import type { ReviewModerationLog } from "../../enterprise/entities/review-moderation-log";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface BarbershopRatingMetrics {
  averageRating: number;
  reviewCount: number;
}

export interface ReviewsRepository {
  create(review: Review): Promise<void>;
  createAtomic(review: Review): Promise<void>;
  findById(id: string): Promise<Review | null>;
  findByBookingId(bookingId: string): Promise<Review | null>;
  findManyByBarbershopId(
    barbershopId: string,
    params: PaginationParams
  ): Promise<{ reviews: Review[]; total: number }>;
  save(review: Review, expectedVersion?: number): Promise<boolean>;
  updateAtomic(review: Review, expectedVersion: number): Promise<boolean>;
  deleteAtomic(review: Review, expectedVersion: number): Promise<boolean>;
  createReport(report: ReviewReport): Promise<void>;
  createModerationLog(log: ReviewModerationLog): Promise<void>;
  moderateReview(
    review: Review,
    log: ReviewModerationLog,
    expectedVersion: number
  ): Promise<boolean>;
  listModerationQueue(
    params: PaginationParams
  ): Promise<{ reviews: Review[]; total: number }>;
  calculateBarbershopRatingMetrics(
    barbershopId: string
  ): Promise<BarbershopRatingMetrics>;
  getBarbershopRatingMetrics(
    barbershopId: string
  ): Promise<BarbershopRatingMetrics>;
}
