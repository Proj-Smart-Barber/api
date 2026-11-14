import type { Review } from "../../enterprise/entities/review";
import type {
  ReviewItem,
  ReviewTargetType,
} from "../../enterprise/entities/review-item";
import type { PlatformFeedback } from "../../enterprise/entities/platform-feedback";
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

export interface TargetRatingMetrics {
  averageRating: number | null;
  reviewCount: number;
}

export interface TargetReviewRecord {
  review: Review;
  item: ReviewItem;
}

export interface ReviewMutationOptions {
  items?: ReviewItem[];
  platformFeedback?: PlatformFeedback | null;
}

export interface ReviewsRepository {
  create(review: Review): Promise<void>;
  createAtomic(review: Review, options?: ReviewMutationOptions): Promise<void>;
  findById(id: string): Promise<Review | null>;
  findByBookingId(bookingId: string): Promise<Review | null>;
  findItemsByReviewId?(reviewId: string): Promise<ReviewItem[]>;
  findItemsByReviewIds?(
    reviewIds: string[],
  ): Promise<Map<string, ReviewItem[]>>;
  findPlatformFeedbackByBookingId?(
    bookingId: string,
  ): Promise<PlatformFeedback | null>;
  findManyByBarbershopId(
    barbershopId: string,
    params: PaginationParams,
  ): Promise<{ reviews: Review[]; total: number }>;
  findManyByTarget?(params: {
    targetType: ReviewTargetType;
    targetId: string;
    barbershopId?: string;
    page: number;
    limit: number;
  }): Promise<{
    entries: TargetReviewRecord[];
    total: number;
    metrics: TargetRatingMetrics;
  }>;
  save(review: Review, expectedVersion?: number): Promise<boolean>;
  updateAtomic(
    review: Review,
    expectedVersion: number,
    options?: ReviewMutationOptions,
  ): Promise<boolean>;
  deleteAtomic(review: Review, expectedVersion: number): Promise<boolean>;
  createReport(report: ReviewReport): Promise<void>;
  createModerationLog(log: ReviewModerationLog): Promise<void>;
  moderateReview(
    review: Review,
    log: ReviewModerationLog,
    expectedVersion: number,
  ): Promise<boolean>;
  listModerationQueue(
    params: PaginationParams,
  ): Promise<{ reviews: Review[]; total: number }>;
  calculateBarbershopRatingMetrics(
    barbershopId: string,
  ): Promise<BarbershopRatingMetrics>;
  getBarbershopRatingMetrics(
    barbershopId: string,
  ): Promise<BarbershopRatingMetrics>;
  getTargetRatingMetrics?(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<TargetRatingMetrics>;
  getTargetRatingMetricsBatch?(
    targetType: ReviewTargetType,
    targetIds: string[],
  ): Promise<Map<string, TargetRatingMetrics>>;
}
