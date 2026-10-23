import type {
  ReviewsRepository,
  PaginationParams,
  BarbershopRatingMetrics,
} from "../../src/domain/application/repositories/reviews-repository";
import type { Review } from "../../src/domain/enterprise/entities/review";
import type { ReviewReport } from "../../src/domain/enterprise/entities/review-report";
import type { ReviewModerationLog } from "../../src/domain/enterprise/entities/review-moderation-log";

export class InMemoryReviewsRepository implements ReviewsRepository {
  public items: Review[] = [];
  public reports: ReviewReport[] = [];
  public moderationLogs: ReviewModerationLog[] = [];

  async create(review: Review): Promise<void> {
    const existing = this.items.find(
      (r) => r.bookingId.toString() === review.bookingId.toString()
    );
    if (existing) {
      throw new Error("Já existe uma avaliação para este agendamento.");
    }
    this.items.push(review);
  }

  async createAtomic(review: Review): Promise<void> {
    await this.create(review);
    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
  }

  async findById(id: string): Promise<Review | null> {
    const review = this.items.find((r) => r.id.toString() === id);
    return review ?? null;
  }

  async findByBookingId(bookingId: string): Promise<Review | null> {
    const review = this.items.find((r) => r.bookingId.toString() === bookingId);
    return review ?? null;
  }

  async findManyByBarbershopId(
    barbershopId: string,
    params: PaginationParams
  ): Promise<{ reviews: Review[]; total: number }> {
    const published = this.items
      .filter((r) => r.barbershopId.toString() === barbershopId && r.status === "PUBLISHED")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = published.length;
    const offset = (params.page - 1) * params.limit;
    const reviews = published.slice(offset, offset + params.limit);

    return { reviews, total };
  }

  async save(review: Review, expectedVersion?: number): Promise<boolean> {
    const index = this.items.findIndex((r) => r.id.toString() === review.id.toString());
    if (index < 0) return false;
    if (expectedVersion !== undefined) {
      const currentVer = this.items[index].version;
      if (currentVer !== expectedVersion && currentVer !== expectedVersion + 1) {
        return false;
      }
    }
    this.items[index] = review;
    return true;
  }

  async updateAtomic(review: Review, expectedVersion: number): Promise<boolean> {
    const saved = await this.save(review, expectedVersion);
    if (!saved) return false;
    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
    return true;
  }

  async deleteAtomic(review: Review, expectedVersion: number): Promise<boolean> {
    const saved = await this.save(review, expectedVersion);
    if (!saved) return false;
    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
    return true;
  }

  async getBarbershopRatingMetrics(
    barbershopId: string
  ): Promise<BarbershopRatingMetrics> {
    return this.calculateBarbershopRatingMetrics(barbershopId);
  }

  async createReport(report: ReviewReport): Promise<void> {
    this.reports.push(report);
  }

  async createModerationLog(log: ReviewModerationLog): Promise<void> {
    this.moderationLogs.push(log);
  }

  async moderateReview(
    review: Review,
    log: ReviewModerationLog,
    expectedVersion: number
  ): Promise<boolean> {
    const saved = await this.save(review, expectedVersion);
    if (!saved) return false;
    await this.createModerationLog(log);
    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
    return true;
  }

  async listModerationQueue(
    params: PaginationParams
  ): Promise<{ reviews: Review[]; total: number }> {
    // Reviews that have reports or are HIDDEN_BY_MODERATION
    const reportedReviewIds = new Set(this.reports.map((rep) => rep.reviewId.toString()));
    const queue = this.items
      .filter(
        (r) =>
          reportedReviewIds.has(r.id.toString()) ||
          r.status === "HIDDEN_BY_MODERATION"
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = queue.length;
    const offset = (params.page - 1) * params.limit;
    const reviews = queue.slice(offset, offset + params.limit);

    return { reviews, total };
  }

  async calculateBarbershopRatingMetrics(
    barbershopId: string
  ): Promise<BarbershopRatingMetrics> {
    const published = this.items.filter(
      (r) => r.barbershopId.toString() === barbershopId && r.status === "PUBLISHED"
    );

    const reviewCount = published.length;
    if (reviewCount === 0) {
      return { averageRating: 0, reviewCount: 0 };
    }

    const totalSum = published.reduce((acc, curr) => acc + curr.rating, 0);
    const averageRating = Number((totalSum / reviewCount).toFixed(2));

    return { averageRating, reviewCount };
  }
}
