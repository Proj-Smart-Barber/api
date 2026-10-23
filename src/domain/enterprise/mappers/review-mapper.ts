// biome-ignore lint/complexity/noStaticOnlyClass: Domain mapper pattern
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Review, type ReviewStatus } from "../entities/review";
import { ReviewReport } from "../entities/review-report";
import { ReviewModerationLog, type ModerationAction } from "../entities/review-moderation-log";

export class ReviewMapper {
  static toDomain(raw: any): Review {
    return Review.create(
      {
        bookingId: new UniqueEntityId(raw.bookingId ?? raw.booking_id),
        barbershopId: new UniqueEntityId(raw.barbershopId ?? raw.barbershop_id),
        customerId: new UniqueEntityId(raw.customerId ?? raw.customer_id),
        rating: Number(raw.rating),
        comment: raw.comment ?? undefined,
        status: (raw.status as ReviewStatus) ?? "PUBLISHED",
        version: Number(raw.version ?? 1),
        createdAt: new Date(raw.createdAt ?? raw.created_at),
        updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
      },
      new UniqueEntityId(raw.id)
    );
  }

  static toPersistence(review: Review): any {
    return {
      id: review.id.toString(),
      bookingId: review.bookingId.toString(),
      barbershopId: review.barbershopId.toString(),
      customerId: review.customerId.toString(),
      rating: review.rating,
      comment: review.comment ?? null,
      status: review.status,
      version: review.version,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  static reportToDomain(raw: any): ReviewReport {
    return ReviewReport.create(
      {
        reviewId: new UniqueEntityId(raw.reviewId ?? raw.review_id),
        reporterId: new UniqueEntityId(raw.reporterId ?? raw.reporter_id),
        reason: raw.reason,
        createdAt: new Date(raw.createdAt ?? raw.created_at),
      },
      new UniqueEntityId(raw.id)
    );
  }

  static reportToPersistence(report: ReviewReport): any {
    return {
      id: report.id.toString(),
      reviewId: report.reviewId.toString(),
      reporterId: report.reporterId.toString(),
      reason: report.reason,
      createdAt: report.createdAt,
    };
  }

  static moderationLogToDomain(raw: any): ReviewModerationLog {
    return ReviewModerationLog.create(
      {
        reviewId: new UniqueEntityId(raw.reviewId ?? raw.review_id),
        adminId: new UniqueEntityId(raw.adminId ?? raw.admin_id),
        action: raw.action as ModerationAction,
        reason: raw.reason,
        createdAt: new Date(raw.createdAt ?? raw.created_at),
      },
      new UniqueEntityId(raw.id)
    );
  }

  static moderationLogToPersistence(log: ReviewModerationLog): any {
    return {
      id: log.id.toString(),
      reviewId: log.reviewId.toString(),
      adminId: log.adminId.toString(),
      action: log.action,
      reason: log.reason,
      createdAt: log.createdAt,
    };
  }
}
