import type {
  ReviewsRepository,
  PaginationParams,
  BarbershopRatingMetrics,
  TargetRatingMetrics,
  TargetReviewRecord,
  ReviewMutationOptions,
} from "../../src/domain/application/repositories/reviews-repository";
import type { Review } from "../../src/domain/enterprise/entities/review";
import {
  ReviewItem,
  type ReviewTargetType,
} from "../../src/domain/enterprise/entities/review-item";
import type { PlatformFeedback } from "../../src/domain/enterprise/entities/platform-feedback";
import type { ReviewReport } from "../../src/domain/enterprise/entities/review-report";
import type { ReviewModerationLog } from "../../src/domain/enterprise/entities/review-moderation-log";

export class InMemoryReviewsRepository implements ReviewsRepository {
  public items: Review[] = [];
  public reviewItems: ReviewItem[] = [];
  public platformFeedbacks: PlatformFeedback[] = [];
  public reports: ReviewReport[] = [];
  public moderationLogs: ReviewModerationLog[] = [];

  private ensureItemsForReview(
    review: Review,
    providedItems?: ReviewItem[],
  ): ReviewItem[] {
    const source = providedItems ?? review.items;
    if (source.length > 0) {
      const hasShop = source.some((item) => item.targetType === "BARBERSHOP");
      if (hasShop) {
        return [...source];
      }
      return [
        ReviewItem.create({
          reviewId: review.id,
          bookingId: review.bookingId,
          targetType: "BARBERSHOP",
          targetKey: ReviewItem.buildTargetKey({
            targetType: "BARBERSHOP",
            targetId: review.barbershopId.toString(),
          }),
          targetId: review.barbershopId,
          bookingServiceItemId: null,
          targetLabel: "Barbearia",
          rating: review.rating,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        }),
        ...source,
      ];
    }

    return [
      ReviewItem.create({
        reviewId: review.id,
        bookingId: review.bookingId,
        targetType: "BARBERSHOP",
        targetKey: ReviewItem.buildTargetKey({
          targetType: "BARBERSHOP",
          targetId: review.barbershopId.toString(),
        }),
        targetId: review.barbershopId,
        bookingServiceItemId: null,
        targetLabel: "Barbearia",
        rating: review.rating,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      }),
    ];
  }

  private assertUniqueReviewItems(items: ReviewItem[]): void {
    const seenKeys = new Set<string>();
    const seenTargetIds = new Set<string>();
    for (const item of items) {
      if (seenKeys.has(item.targetKey)) {
        throw new Error(
          "Não é permitido avaliar o mesmo alvo mais de uma vez.",
        );
      }
      seenKeys.add(item.targetKey);
      if (item.targetId) {
        const composite = `${item.targetType}:${item.targetId.toString()}`;
        if (seenTargetIds.has(composite)) {
          throw new Error(
            "Não é permitido avaliar o mesmo alvo mais de uma vez.",
          );
        }
        seenTargetIds.add(composite);
      }
    }
  }

  private upsertPlatformFeedback(feedback: PlatformFeedback): void {
    const bookingId = feedback.bookingId.toString();
    const existingIdx = this.platformFeedbacks.findIndex(
      (f) => f.bookingId.toString() === bookingId,
    );
    if (existingIdx >= 0) {
      this.platformFeedbacks[existingIdx] = feedback;
    } else {
      this.platformFeedbacks.push(feedback);
    }
  }

  async create(review: Review): Promise<void> {
    await this.createAtomic(review);
  }

  async createAtomic(
    review: Review,
    options?: ReviewMutationOptions,
  ): Promise<void> {
    const existing = this.items.find(
      (r) => r.bookingId.toString() === review.bookingId.toString(),
    );
    if (existing) {
      throw new Error("Já existe uma avaliação para este agendamento.");
    }

    const itemsToPersist = this.ensureItemsForReview(review, options?.items);
    this.assertUniqueReviewItems(itemsToPersist);

    review.setItems(itemsToPersist);
    this.items.push(review);
    this.reviewItems.push(...itemsToPersist);

    if (options?.platformFeedback) {
      this.upsertPlatformFeedback(options.platformFeedback);
    }

    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
  }

  async findById(id: string): Promise<Review | null> {
    const review = this.items.find((r) => r.id.toString() === id);
    if (!review) return null;
    const matchedItems = await this.findItemsByReviewId(review.id.toString());
    if (matchedItems.length > 0) {
      review.setItems(matchedItems);
    }
    return review;
  }

  async findByBookingId(bookingId: string): Promise<Review | null> {
    const review = this.items.find((r) => r.bookingId.toString() === bookingId);
    if (!review) return null;
    const matchedItems = await this.findItemsByReviewId(review.id.toString());
    if (matchedItems.length > 0) {
      review.setItems(matchedItems);
    }
    return review;
  }

  async findItemsByReviewId(reviewId: string): Promise<ReviewItem[]> {
    return this.reviewItems.filter((i) => i.reviewId.toString() === reviewId);
  }

  async findItemsByReviewIds(
    reviewIds: string[],
  ): Promise<Map<string, ReviewItem[]>> {
    const map = new Map<string, ReviewItem[]>();
    const idSet = new Set(reviewIds);
    for (const item of this.reviewItems) {
      const rid = item.reviewId.toString();
      if (!idSet.has(rid)) continue;
      const list = map.get(rid) ?? [];
      list.push(item);
      map.set(rid, list);
    }
    return map;
  }

  async findPlatformFeedbackByBookingId(
    bookingId: string,
  ): Promise<PlatformFeedback | null> {
    return (
      this.platformFeedbacks.find(
        (f) => f.bookingId.toString() === bookingId,
      ) ?? null
    );
  }

  async findManyByBarbershopId(
    barbershopId: string,
    params: PaginationParams,
  ): Promise<{ reviews: Review[]; total: number }> {
    const published = this.items
      .filter(
        (r) =>
          r.barbershopId.toString() === barbershopId &&
          r.status === "PUBLISHED",
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = published.length;
    const offset = (params.page - 1) * params.limit;
    const pageReviews = published.slice(offset, offset + params.limit);

    for (const r of pageReviews) {
      const linked = await this.findItemsByReviewId(r.id.toString());
      if (linked.length > 0) {
        r.setItems(linked);
      }
    }

    return { reviews: pageReviews, total };
  }

  async findManyByTarget(params: {
    targetType: ReviewTargetType;
    targetId: string;
    barbershopId?: string;
    page: number;
    limit: number;
  }): Promise<{
    entries: TargetReviewRecord[];
    total: number;
    metrics: TargetRatingMetrics;
  }> {
    const reviewById = new Map(this.items.map((r) => [r.id.toString(), r]));
    const matching: TargetReviewRecord[] = [];

    for (const item of this.reviewItems) {
      if (item.targetType !== params.targetType) continue;
      if (item.targetId?.toString() !== params.targetId) continue;
      const review = reviewById.get(item.reviewId.toString());
      if (!review || review.status !== "PUBLISHED") continue;
      if (
        params.barbershopId &&
        review.barbershopId.toString() !== params.barbershopId
      ) {
        continue;
      }
      matching.push({ review, item });
    }

    matching.sort(
      (a, b) => b.review.createdAt.getTime() - a.review.createdAt.getTime(),
    );

    const total = matching.length;
    const avg =
      total > 0
        ? Number(
            (
              matching.reduce((acc, entry) => acc + entry.item.rating, 0) /
              total
            ).toFixed(2),
          )
        : null;

    const offset = (params.page - 1) * params.limit;
    return {
      entries: matching.slice(offset, offset + params.limit),
      total,
      metrics: {
        averageRating: avg,
        reviewCount: total,
      },
    };
  }

  async save(review: Review, expectedVersion?: number): Promise<boolean> {
    const index = this.items.findIndex(
      (r) => r.id.toString() === review.id.toString(),
    );
    if (index < 0) return false;
    if (expectedVersion !== undefined) {
      const currentVer = this.items[index].version;
      if (
        currentVer !== expectedVersion &&
        currentVer !== expectedVersion + 1
      ) {
        return false;
      }
    }
    this.items[index] = review;
    return true;
  }

  async updateAtomic(
    review: Review,
    expectedVersion: number,
    options?: ReviewMutationOptions,
  ): Promise<boolean> {
    const saved = await this.save(review, expectedVersion);
    if (!saved) return false;

    const reviewId = review.id.toString();
    if (options?.items !== undefined) {
      const nextItems = this.ensureItemsForReview(review, options.items);
      this.assertUniqueReviewItems(nextItems);
      this.reviewItems = this.reviewItems.filter(
        (i) => i.reviewId.toString() !== reviewId,
      );
      this.reviewItems.push(...nextItems);
      review.setItems(nextItems);
    } else {
      this.reviewItems = this.reviewItems.map((i) =>
        i.reviewId.toString() === reviewId && i.targetType === "BARBERSHOP"
          ? ReviewItem.create(
              {
                reviewId: i.reviewId,
                bookingId: i.bookingId,
                targetType: i.targetType,
                targetKey: i.targetKey,
                targetId: i.targetId,
                bookingServiceItemId: i.bookingServiceItemId,
                targetLabel: i.targetLabel,
                rating: review.rating,
                createdAt: i.createdAt,
                updatedAt: review.updatedAt,
              },
              i.id,
            )
          : i,
      );
    }

    if (options?.platformFeedback) {
      this.upsertPlatformFeedback(options.platformFeedback);
    }

    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
    return true;
  }

  async deleteAtomic(
    review: Review,
    expectedVersion: number,
  ): Promise<boolean> {
    const saved = await this.save(review, expectedVersion);
    if (!saved) return false;
    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
    return true;
  }

  async getBarbershopRatingMetrics(
    barbershopId: string,
  ): Promise<BarbershopRatingMetrics> {
    return this.calculateBarbershopRatingMetrics(barbershopId);
  }

  async getTargetRatingMetrics(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<TargetRatingMetrics> {
    const map = await this.getTargetRatingMetricsBatch(targetType, [targetId]);
    return (
      map.get(targetId) ?? {
        averageRating: null,
        reviewCount: 0,
      }
    );
  }

  async getTargetRatingMetricsBatch(
    targetType: ReviewTargetType,
    targetIds: string[],
  ): Promise<Map<string, TargetRatingMetrics>> {
    const reviewStatusById = new Map(
      this.items.map((r) => [r.id.toString(), r.status]),
    );
    const sums = new Map<string, { sum: number; count: number }>();

    for (const item of this.reviewItems) {
      if (item.targetType !== targetType || !item.targetId) continue;
      const tid = item.targetId.toString();
      if (!targetIds.includes(tid)) continue;
      if (reviewStatusById.get(item.reviewId.toString()) !== "PUBLISHED") {
        continue;
      }
      const prev = sums.get(tid) ?? { sum: 0, count: 0 };
      prev.sum += item.rating;
      prev.count += 1;
      sums.set(tid, prev);
    }

    const result = new Map<string, TargetRatingMetrics>();
    for (const [id, data] of sums.entries()) {
      result.set(id, {
        averageRating:
          data.count > 0 ? Number((data.sum / data.count).toFixed(2)) : null,
        reviewCount: data.count,
      });
    }
    return result;
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
    expectedVersion: number,
  ): Promise<boolean> {
    const saved = await this.save(review, expectedVersion);
    if (!saved) return false;
    await this.createModerationLog(log);
    await this.calculateBarbershopRatingMetrics(review.barbershopId.toString());
    return true;
  }

  async listModerationQueue(
    params: PaginationParams,
  ): Promise<{ reviews: Review[]; total: number }> {
    const reportedReviewIds = new Set(
      this.reports.map((rep) => rep.reviewId.toString()),
    );
    const queue = this.items
      .filter(
        (r) =>
          reportedReviewIds.has(r.id.toString()) ||
          r.status === "HIDDEN_BY_MODERATION",
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = queue.length;
    const offset = (params.page - 1) * params.limit;
    const reviews = queue.slice(offset, offset + params.limit);

    return { reviews, total };
  }

  async calculateBarbershopRatingMetrics(
    barbershopId: string,
  ): Promise<BarbershopRatingMetrics> {
    const metricsMap = await this.getTargetRatingMetricsBatch("BARBERSHOP", [
      barbershopId,
    ]);
    const entry = metricsMap.get(barbershopId);
    if (entry && entry.reviewCount > 0 && entry.averageRating !== null) {
      return {
        averageRating: entry.averageRating,
        reviewCount: entry.reviewCount,
      };
    }

    const published = this.items.filter(
      (r) =>
        r.barbershopId.toString() === barbershopId && r.status === "PUBLISHED",
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
