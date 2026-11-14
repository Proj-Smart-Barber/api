import { eq, and, desc, count, sql, inArray } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { db as defaultDb } from "../index";
import {
  reviews,
  reviewItems,
  platformFeedbacks,
  reviewReports,
  reviewModerationLogs,
  barbershops,
  services,
} from "../schema";
import { ReviewMapper } from "../../../domain/enterprise/mappers/review-mapper";
import type {
  ReviewsRepository,
  PaginationParams,
  BarbershopRatingMetrics,
  TargetRatingMetrics,
  TargetReviewRecord,
  ReviewMutationOptions,
} from "../../../domain/application/repositories/reviews-repository";
import type { Review } from "../../../domain/enterprise/entities/review";
import {
  ReviewItem,
  type ReviewTargetType,
} from "../../../domain/enterprise/entities/review-item";
import type { PlatformFeedback } from "../../../domain/enterprise/entities/platform-feedback";
import type { ReviewReport } from "../../../domain/enterprise/entities/review-report";
import type { ReviewModerationLog } from "../../../domain/enterprise/entities/review-moderation-log";

export class DrizzleReviewsRepository implements ReviewsRepository {
  constructor(private db = defaultDb) {}

  private resolveItemsForCreateOrUpdate(
    entity: Review,
    providedItems?: ReviewItem[],
  ): ReviewItem[] {
    if (providedItems && providedItems.length > 0) {
      const hasBarbershop = providedItems.some(
        (item) => item.targetType === "BARBERSHOP",
      );
      if (hasBarbershop) {
        return providedItems;
      }
      return [
        ReviewItem.create({
          reviewId: entity.id,
          bookingId: entity.bookingId,
          targetType: "BARBERSHOP",
          targetKey: ReviewItem.buildTargetKey({
            targetType: "BARBERSHOP",
            targetId: entity.barbershopId.toString(),
          }),
          targetId: entity.barbershopId,
          bookingServiceItemId: null,
          targetLabel: "Barbearia",
          rating: entity.rating,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        }),
        ...providedItems,
      ];
    }

    if (entity.items.length > 0) {
      return entity.items;
    }

    return [
      ReviewItem.create({
        reviewId: entity.id,
        bookingId: entity.bookingId,
        targetType: "BARBERSHOP",
        targetKey: ReviewItem.buildTargetKey({
          targetType: "BARBERSHOP",
          targetId: entity.barbershopId.toString(),
        }),
        targetId: entity.barbershopId,
        bookingServiceItemId: null,
        targetLabel: "Barbearia",
        rating: entity.rating,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
    ];
  }

  private async recalculateAggregatesTx(
    tx: any,
    barbershopId: string,
    serviceIds: string[],
  ): Promise<void> {
    const [shopAgg] = await tx
      .select({
        avg: sql<string>`COALESCE(AVG(${reviewItems.rating}), 0)`,
        count: count(),
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(
        and(
          eq(reviewItems.targetType, "BARBERSHOP"),
          eq(reviewItems.targetId, barbershopId),
          eq(reviews.status, "PUBLISHED"),
        ),
      );

    const shopAvg = Number(parseFloat(shopAgg?.avg ?? "0").toFixed(2));
    const shopCount = Number(shopAgg?.count ?? 0);

    await tx
      .update(barbershops)
      .set({
        rating: (shopCount > 0 ? shopAvg : 0).toFixed(2),
        reviewCount: shopCount,
      })
      .where(eq(barbershops.id, barbershopId));

    const uniqueServiceIds = Array.from(new Set(serviceIds)).sort();
    if (uniqueServiceIds.length === 0) {
      return;
    }

    const idListSql = sql.join(
      uniqueServiceIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    await tx.execute(
      sql`SELECT id FROM services WHERE id IN (${idListSql}) ORDER BY id ASC FOR UPDATE`,
    );

    const serviceAggs = await tx
      .select({
        serviceId: reviewItems.targetId,
        avg: sql<string>`COALESCE(AVG(${reviewItems.rating}), 0)`,
        count: count(),
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(
        and(
          eq(reviewItems.targetType, "SERVICE"),
          inArray(reviewItems.targetId, uniqueServiceIds),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .groupBy(reviewItems.targetId);

    const aggByServiceId = new Map<string, { avg: number; count: number }>();
    for (const row of serviceAggs) {
      if (!row.serviceId) continue;
      const cnt = Number(row.count ?? 0);
      const avg = cnt > 0 ? Number(parseFloat(row.avg ?? "0").toFixed(2)) : 0;
      aggByServiceId.set(row.serviceId, { avg, count: cnt });
    }

    for (const serviceId of uniqueServiceIds) {
      const agg = aggByServiceId.get(serviceId) ?? { avg: 0, count: 0 };
      await tx
        .update(services)
        .set({
          rating: agg.avg.toFixed(2),
          reviewCount: agg.count,
        })
        .where(eq(services.id, serviceId));
    }
  }

  private async upsertPlatformFeedbackTx(
    tx: any,
    feedback: PlatformFeedback,
  ): Promise<void> {
    const data = ReviewMapper.platformFeedbackToPersistence(feedback);
    await tx
      .insert(platformFeedbacks)
      .values(data)
      .onConflictDoUpdate({
        target: platformFeedbacks.bookingId,
        set: {
          reviewId: data.reviewId,
          rating: data.rating,
          comment: data.comment,
          updatedAt: data.updatedAt,
        },
      });
  }

  async create(entity: Review): Promise<void> {
    await this.createAtomic(entity);
  }

  async createAtomic(
    entity: Review,
    options?: ReviewMutationOptions,
  ): Promise<void> {
    const barbershopId = entity.barbershopId.toString();
    const resolvedItems = this.resolveItemsForCreateOrUpdate(
      entity,
      options?.items,
    );

    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`,
      );

      const data = ReviewMapper.toPersistence(entity);
      try {
        await tx.insert(reviews).values(data);
      } catch (err: any) {
        if (
          err.code === "23505" ||
          err.message?.includes("unique") ||
          err.message?.includes("duplicate key")
        ) {
          throw new Error("Já existe uma avaliação para este agendamento.");
        }
        throw err;
      }

      if (resolvedItems.length > 0) {
        await tx
          .insert(reviewItems)
          .values(resolvedItems.map(ReviewMapper.itemToPersistence));
      }

      if (options?.platformFeedback) {
        await this.upsertPlatformFeedbackTx(tx, options.platformFeedback);
      }

      const affectedServiceIds = resolvedItems
        .filter((i) => i.targetType === "SERVICE" && i.targetId)
        .map((i) => i.targetId!.toString());

      await this.recalculateAggregatesTx(tx, barbershopId, affectedServiceIds);
    });
  }

  async findById(id: string): Promise<Review | null> {
    const [row] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id));
    if (!row) return null;
    const itemRows = await this.findItemsByReviewId(row.id);
    return ReviewMapper.toDomain(row, itemRows);
  }

  async findByBookingId(bookingId: string): Promise<Review | null> {
    const [row] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.bookingId, bookingId));
    if (!row) return null;
    const itemRows = await this.findItemsByReviewId(row.id);
    return ReviewMapper.toDomain(row, itemRows);
  }

  async findItemsByReviewId(reviewId: string): Promise<ReviewItem[]> {
    const rows = await this.db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.reviewId, reviewId));
    return rows.map(ReviewMapper.itemToDomain);
  }

  async findItemsByReviewIds(
    reviewIds: string[],
  ): Promise<Map<string, ReviewItem[]>> {
    const map = new Map<string, ReviewItem[]>();
    if (reviewIds.length === 0) return map;

    const rows = await this.db
      .select()
      .from(reviewItems)
      .where(inArray(reviewItems.reviewId, reviewIds));

    for (const row of rows) {
      const domainItem = ReviewMapper.itemToDomain(row);
      const list = map.get(row.reviewId) ?? [];
      list.push(domainItem);
      map.set(row.reviewId, list);
    }

    return map;
  }

  async findPlatformFeedbackByBookingId(
    bookingId: string,
  ): Promise<PlatformFeedback | null> {
    const [row] = await this.db
      .select()
      .from(platformFeedbacks)
      .where(eq(platformFeedbacks.bookingId, bookingId));
    if (!row) return null;
    return ReviewMapper.platformFeedbackToDomain(row);
  }

  async findManyByBarbershopId(
    barbershopId: string,
    params: PaginationParams,
  ): Promise<{ reviews: Review[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const [countResult] = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(
        and(
          eq(reviews.barbershopId, barbershopId),
          eq(reviews.status, "PUBLISHED"),
        ),
      );

    const total = Number(countResult?.count ?? 0);

    const rows = await this.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.barbershopId, barbershopId),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(params.limit)
      .offset(offset);

    const itemsMap = await this.findItemsByReviewIds(rows.map((r) => r.id));

    return {
      reviews: rows.map((row) =>
        ReviewMapper.toDomain(row, itemsMap.get(row.id) ?? []),
      ),
      total,
    };
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
    const offset = (params.page - 1) * params.limit;

    const conditions = [
      eq(reviewItems.targetType, params.targetType),
      eq(reviewItems.targetId, params.targetId),
      eq(reviews.status, "PUBLISHED"),
    ];
    if (params.barbershopId) {
      conditions.push(eq(reviews.barbershopId, params.barbershopId));
    }

    const whereClause = and(...conditions);

    const [aggRes] = await this.db
      .select({
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
        count: count(),
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(whereClause);

    const total = Number(aggRes?.count ?? 0);
    const parsedAvg =
      aggRes?.avg !== null && aggRes?.avg !== undefined
        ? Number(parseFloat(String(aggRes.avg)).toFixed(2))
        : null;
    const metrics: TargetRatingMetrics = {
      averageRating: total > 0 ? parsedAvg : null,
      reviewCount: total,
    };

    const rows = await this.db
      .select({
        review: reviews,
        item: reviewItems,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(whereClause)
      .orderBy(desc(reviews.createdAt))
      .limit(params.limit)
      .offset(offset);

    return {
      entries: rows.map((row) => ({
        review: ReviewMapper.toDomain(row.review),
        item: ReviewMapper.itemToDomain(row.item),
      })),
      total,
      metrics,
    };
  }

  async save(entity: Review, expectedVersion?: number): Promise<boolean> {
    const data = ReviewMapper.toPersistence(entity);
    const condition =
      expectedVersion !== undefined
        ? and(
            eq(reviews.id, entity.id.toString()),
            eq(reviews.version, expectedVersion),
          )
        : eq(reviews.id, entity.id.toString());

    const result = await this.db
      .update(reviews)
      .set(data)
      .where(condition)
      .returning({ id: reviews.id });

    return result.length > 0;
  }

  async updateAtomic(
    entity: Review,
    expectedVersion: number,
    options?: ReviewMutationOptions,
  ): Promise<boolean> {
    const barbershopId = entity.barbershopId.toString();
    const reviewId = entity.id.toString();

    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`,
      );

      const existingItems = await tx
        .select()
        .from(reviewItems)
        .where(eq(reviewItems.reviewId, reviewId));

      const data = ReviewMapper.toPersistence(entity);
      const condition = and(
        eq(reviews.id, reviewId),
        eq(reviews.version, expectedVersion),
      );

      const result = await tx
        .update(reviews)
        .set(data)
        .where(condition)
        .returning({ id: reviews.id });

      if (result.length === 0) {
        return false;
      }

      const nextItems =
        options?.items !== undefined
          ? this.resolveItemsForCreateOrUpdate(entity, options.items)
          : undefined;

      if (nextItems !== undefined) {
        await tx.delete(reviewItems).where(eq(reviewItems.reviewId, reviewId));
        if (nextItems.length > 0) {
          await tx
            .insert(reviewItems)
            .values(nextItems.map(ReviewMapper.itemToPersistence));
        }
      } else {
        await tx
          .update(reviewItems)
          .set({ rating: entity.rating, updatedAt: entity.updatedAt })
          .where(
            and(
              eq(reviewItems.reviewId, reviewId),
              eq(reviewItems.targetType, "BARBERSHOP"),
            ),
          );
      }

      if (options?.platformFeedback) {
        await this.upsertPlatformFeedbackTx(tx, options.platformFeedback);
      }

      const affectedServiceIds = [
        ...existingItems
          .filter((i: any) => i.targetType === "SERVICE" && i.targetId)
          .map((i: any) => String(i.targetId)),
        ...(nextItems ?? [])
          .filter((i) => i.targetType === "SERVICE" && i.targetId)
          .map((i) => i.targetId!.toString()),
      ];

      await this.recalculateAggregatesTx(tx, barbershopId, affectedServiceIds);

      return true;
    });
  }

  async deleteAtomic(
    entity: Review,
    expectedVersion: number,
  ): Promise<boolean> {
    const barbershopId = entity.barbershopId.toString();
    const reviewId = entity.id.toString();

    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`,
      );

      const existingItems = await tx
        .select()
        .from(reviewItems)
        .where(eq(reviewItems.reviewId, reviewId));

      const data = ReviewMapper.toPersistence(entity);
      const condition = and(
        eq(reviews.id, reviewId),
        eq(reviews.version, expectedVersion),
      );

      const result = await tx
        .update(reviews)
        .set(data)
        .where(condition)
        .returning({ id: reviews.id });

      if (result.length === 0) {
        return false;
      }

      const affectedServiceIds = existingItems
        .filter((i: any) => i.targetType === "SERVICE" && i.targetId)
        .map((i: any) => String(i.targetId));

      await this.recalculateAggregatesTx(tx, barbershopId, affectedServiceIds);

      return true;
    });
  }

  async createReport(report: ReviewReport): Promise<void> {
    const data = ReviewMapper.reportToPersistence(report);
    await this.db.insert(reviewReports).values(data);
  }

  async createModerationLog(log: ReviewModerationLog): Promise<void> {
    const data = ReviewMapper.moderationLogToPersistence(log);
    await this.db.insert(reviewModerationLogs).values(data);
  }

  async moderateReview(
    review: Review,
    log: ReviewModerationLog,
    expectedVersion: number,
  ): Promise<boolean> {
    const barbershopId = review.barbershopId.toString();
    const reviewId = review.id.toString();

    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`,
      );

      const existingItems = await tx
        .select()
        .from(reviewItems)
        .where(eq(reviewItems.reviewId, reviewId));

      const data = ReviewMapper.toPersistence(review);
      const condition = and(
        eq(reviews.id, reviewId),
        eq(reviews.version, expectedVersion),
      );

      const updated = await tx
        .update(reviews)
        .set(data)
        .where(condition)
        .returning({ id: reviews.id });

      if (updated.length === 0) {
        return false;
      }

      const logData = ReviewMapper.moderationLogToPersistence(log);
      await tx.insert(reviewModerationLogs).values(logData);

      const affectedServiceIds = existingItems
        .filter((i: any) => i.targetType === "SERVICE" && i.targetId)
        .map((i: any) => String(i.targetId));

      await this.recalculateAggregatesTx(tx, barbershopId, affectedServiceIds);

      return true;
    });
  }

  async listModerationQueue(
    params: PaginationParams,
  ): Promise<{ reviews: Review[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const reportedRows = await this.db
      .selectDistinct({ reviewId: reviewReports.reviewId })
      .from(reviewReports);

    const reportedIds = reportedRows.map((r) => r.reviewId);

    const whereCondition =
      reportedIds.length > 0
        ? sql`${reviews.status} = 'HIDDEN_BY_MODERATION' OR ${inArray(reviews.id, reportedIds)}`
        : eq(reviews.status, "HIDDEN_BY_MODERATION");

    const [countRes] = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(whereCondition);

    const total = Number(countRes?.count ?? 0);

    const rows = await this.db
      .select()
      .from(reviews)
      .where(whereCondition)
      .orderBy(desc(reviews.updatedAt))
      .limit(params.limit)
      .offset(offset);

    return {
      reviews: rows.map((row) => ReviewMapper.toDomain(row)),
      total,
    };
  }

  async getBarbershopRatingMetrics(
    barbershopId: string,
  ): Promise<BarbershopRatingMetrics> {
    const [result] = await this.db
      .select({
        avg: sql<string>`COALESCE(AVG(${reviewItems.rating}), 0)`,
        count: count(),
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(
        and(
          eq(reviewItems.targetType, "BARBERSHOP"),
          eq(reviewItems.targetId, barbershopId),
          eq(reviews.status, "PUBLISHED"),
        ),
      );

    const reviewCount = Number(result?.count ?? 0);
    const averageRating =
      reviewCount > 0 ? Number(parseFloat(result?.avg ?? "0").toFixed(2)) : 0;

    return {
      averageRating,
      reviewCount,
    };
  }

  async calculateBarbershopRatingMetrics(
    barbershopId: string,
  ): Promise<BarbershopRatingMetrics> {
    const metrics = await this.getBarbershopRatingMetrics(barbershopId);

    await this.db
      .update(barbershops)
      .set({
        rating: metrics.averageRating.toFixed(2),
        reviewCount: metrics.reviewCount,
      })
      .where(eq(barbershops.id, barbershopId));

    return metrics;
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
    const map = new Map<string, TargetRatingMetrics>();
    if (targetIds.length === 0) return map;

    const uniqueIds = Array.from(new Set(targetIds));
    const rows = await this.db
      .select({
        targetId: reviewItems.targetId,
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
        count: count(),
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(
        and(
          eq(reviewItems.targetType, targetType),
          inArray(reviewItems.targetId, uniqueIds),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .groupBy(reviewItems.targetId);

    for (const row of rows) {
      if (!row.targetId) continue;
      const reviewCount = Number(row.count ?? 0);
      const parsedAvg =
        row.avg !== null && row.avg !== undefined
          ? Number(parseFloat(String(row.avg)).toFixed(2))
          : null;
      map.set(row.targetId, {
        averageRating: reviewCount > 0 ? parsedAvg : null,
        reviewCount,
      });
    }

    return map;
  }
}
