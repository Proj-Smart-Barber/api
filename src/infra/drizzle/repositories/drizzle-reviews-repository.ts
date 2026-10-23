import { eq, and, desc, count, sql, inArray } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { reviews, reviewReports, reviewModerationLogs, barbershops } from "../schema";
import { ReviewMapper } from "../../../domain/enterprise/mappers/review-mapper";
import type {
  ReviewsRepository,
  PaginationParams,
  BarbershopRatingMetrics,
} from "../../../domain/application/repositories/reviews-repository";
import type { Review } from "../../../domain/enterprise/entities/review";
import type { ReviewReport } from "../../../domain/enterprise/entities/review-report";
import type { ReviewModerationLog } from "../../../domain/enterprise/entities/review-moderation-log";

export class DrizzleReviewsRepository implements ReviewsRepository {
  constructor(private db = defaultDb) {}

  async create(entity: Review): Promise<void> {
    const data = ReviewMapper.toPersistence(entity);
    try {
      await this.db.insert(reviews).values(data);
    } catch (err: any) {
      if (err.code === "23505" || err.message?.includes("unique") || err.message?.includes("duplicate key")) {
        throw new Error("Já existe uma avaliação para este agendamento.");
      }
      throw err;
    }
  }

  async createAtomic(entity: Review): Promise<void> {
    const barbershopId = entity.barbershopId.toString();
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`
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

      const [result] = await tx
        .select({
          avg: sql<string>`COALESCE(AVG(${reviews.rating}), 0)`,
          count: count(),
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.barbershopId, barbershopId),
            eq(reviews.status, "PUBLISHED")
          )
        );

      const averageRating = Number(parseFloat(result?.avg ?? "0").toFixed(2));
      const reviewCount = result?.count ?? 0;

      await tx
        .update(barbershops)
        .set({
          rating: averageRating.toFixed(2),
          reviewCount,
        })
        .where(eq(barbershops.id, barbershopId));
    });
  }

  async findById(id: string): Promise<Review | null> {
    const [row] = await this.db.select().from(reviews).where(eq(reviews.id, id));
    if (!row) return null;
    return ReviewMapper.toDomain(row);
  }

  async findByBookingId(bookingId: string): Promise<Review | null> {
    const [row] = await this.db.select().from(reviews).where(eq(reviews.bookingId, bookingId));
    if (!row) return null;
    return ReviewMapper.toDomain(row);
  }

  async findManyByBarbershopId(
    barbershopId: string,
    params: PaginationParams
  ): Promise<{ reviews: Review[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const [countResult] = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(and(eq(reviews.barbershopId, barbershopId), eq(reviews.status, "PUBLISHED")));

    const total = countResult?.count ?? 0;

    const rows = await this.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.barbershopId, barbershopId), eq(reviews.status, "PUBLISHED")))
      .orderBy(desc(reviews.createdAt))
      .limit(params.limit)
      .offset(offset);

    return {
      reviews: rows.map(ReviewMapper.toDomain),
      total,
    };
  }

  async save(entity: Review, expectedVersion?: number): Promise<boolean> {
    const data = ReviewMapper.toPersistence(entity);
    const condition =
      expectedVersion !== undefined
        ? and(eq(reviews.id, entity.id.toString()), eq(reviews.version, expectedVersion))
        : eq(reviews.id, entity.id.toString());

    const result = await this.db
      .update(reviews)
      .set(data)
      .where(condition)
      .returning({ id: reviews.id });

    return result.length > 0;
  }

  async updateAtomic(entity: Review, expectedVersion: number): Promise<boolean> {
    const barbershopId = entity.barbershopId.toString();
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`
      );

      const data = ReviewMapper.toPersistence(entity);
      const condition = and(
        eq(reviews.id, entity.id.toString()),
        eq(reviews.version, expectedVersion)
      );

      const result = await tx
        .update(reviews)
        .set(data)
        .where(condition)
        .returning({ id: reviews.id });

      if (result.length === 0) {
        return false;
      }

      const [metricsRes] = await tx
        .select({
          avg: sql<string>`COALESCE(AVG(${reviews.rating}), 0)`,
          count: count(),
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.barbershopId, barbershopId),
            eq(reviews.status, "PUBLISHED")
          )
        );

      const averageRating = Number(parseFloat(metricsRes?.avg ?? "0").toFixed(2));
      const reviewCount = metricsRes?.count ?? 0;

      await tx
        .update(barbershops)
        .set({
          rating: averageRating.toFixed(2),
          reviewCount,
        })
        .where(eq(barbershops.id, barbershopId));

      return true;
    });
  }

  async deleteAtomic(entity: Review, expectedVersion: number): Promise<boolean> {
    const barbershopId = entity.barbershopId.toString();
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${barbershopId} FOR UPDATE`
      );

      const data = ReviewMapper.toPersistence(entity);
      const condition = and(
        eq(reviews.id, entity.id.toString()),
        eq(reviews.version, expectedVersion)
      );

      const result = await tx
        .update(reviews)
        .set(data)
        .where(condition)
        .returning({ id: reviews.id });

      if (result.length === 0) {
        return false;
      }

      const [metricsRes] = await tx
        .select({
          avg: sql<string>`COALESCE(AVG(${reviews.rating}), 0)`,
          count: count(),
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.barbershopId, barbershopId),
            eq(reviews.status, "PUBLISHED")
          )
        );

      const averageRating = Number(parseFloat(metricsRes?.avg ?? "0").toFixed(2));
      const reviewCount = metricsRes?.count ?? 0;

      await tx
        .update(barbershops)
        .set({
          rating: averageRating.toFixed(2),
          reviewCount,
        })
        .where(eq(barbershops.id, barbershopId));

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
    expectedVersion: number
  ): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM barbershops WHERE id = ${review.barbershopId.toString()} FOR UPDATE`
      );

      const data = ReviewMapper.toPersistence(review);
      const condition = and(
        eq(reviews.id, review.id.toString()),
        eq(reviews.version, expectedVersion)
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

      // Recalcular métricas dentro da mesma transação
      const [result] = await tx
        .select({
          avg: sql<string>`COALESCE(AVG(${reviews.rating}), 0)`,
          count: count(),
        })
        .from(reviews)
        .where(
          and(
            eq(reviews.barbershopId, review.barbershopId.toString()),
            eq(reviews.status, "PUBLISHED")
          )
        );

      const averageRating = Number(parseFloat(result?.avg ?? "0").toFixed(2));
      const reviewCount = result?.count ?? 0;

      await tx
        .update(barbershops)
        .set({
          rating: averageRating.toFixed(2),
          reviewCount,
        })
        .where(eq(barbershops.id, review.barbershopId.toString()));

      return true;
    });
  }

  async listModerationQueue(
    params: PaginationParams
  ): Promise<{ reviews: Review[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    // Distinct review IDs with reports
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

    const total = countRes?.count ?? 0;

    const rows = await this.db
      .select()
      .from(reviews)
      .where(whereCondition)
      .orderBy(desc(reviews.updatedAt))
      .limit(params.limit)
      .offset(offset);

    return {
      reviews: rows.map(ReviewMapper.toDomain),
      total,
    };
  }

  async getBarbershopRatingMetrics(
    barbershopId: string
  ): Promise<BarbershopRatingMetrics> {
    const [result] = await this.db
      .select({
        avg: sql<string>`COALESCE(AVG(${reviews.rating}), 0)`,
        count: count(),
      })
      .from(reviews)
      .where(and(eq(reviews.barbershopId, barbershopId), eq(reviews.status, "PUBLISHED")));

    const averageRating = Number(parseFloat(result?.avg ?? "0").toFixed(2));
    const reviewCount = result?.count ?? 0;

    return {
      averageRating,
      reviewCount,
    };
  }

  async calculateBarbershopRatingMetrics(
    barbershopId: string
  ): Promise<BarbershopRatingMetrics> {
    const metrics = await this.getBarbershopRatingMetrics(barbershopId);

    // Update the aggregated columns in barbershops table transactionally or directly
    await this.db
      .update(barbershops)
      .set({
        rating: metrics.averageRating.toFixed(2),
        reviewCount: metrics.reviewCount,
      })
      .where(eq(barbershops.id, barbershopId));

    return metrics;
  }
}
