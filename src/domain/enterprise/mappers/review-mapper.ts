// biome-ignore lint/complexity/noStaticOnlyClass: Domain mapper pattern
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Review, type ReviewStatus } from "../entities/review";
import { ReviewItem, type ReviewTargetType } from "../entities/review-item";
import { PlatformFeedback } from "../entities/platform-feedback";
import { ReviewReport } from "../entities/review-report";
import {
  ReviewModerationLog,
  type ModerationAction,
} from "../entities/review-moderation-log";

export class ReviewMapper {
  static toDomain(raw: any, items?: ReviewItem[]): Review {
    return Review.create(
      {
        bookingId: new UniqueEntityId(raw.bookingId ?? raw.booking_id),
        barbershopId: new UniqueEntityId(raw.barbershopId ?? raw.barbershop_id),
        customerId: new UniqueEntityId(raw.customerId ?? raw.customer_id),
        rating: Number(raw.rating),
        comment: raw.comment ?? undefined,
        items,
        status: (raw.status as ReviewStatus) ?? "PUBLISHED",
        version: Number(raw.version ?? 1),
        createdAt: new Date(raw.createdAt ?? raw.created_at),
        updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toHTTP(
    review: Review,
    items?: ReviewItem[],
    platformFeedback?: PlatformFeedback | null,
  ) {
    const resolvedItems = items ?? review.items;
    return {
      id: review.id.toString(),
      bookingId: review.bookingId.toString(),
      barbershopId: review.barbershopId.toString(),
      customerId: review.customerId.toString(),
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      version: review.version,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      items: resolvedItems.map((item) => ({
        id: item.id.toString(),
        targetType: item.targetType,
        targetId: item.targetId?.toString() ?? null,
        bookingServiceItemId: item.bookingServiceItemId?.toString() ?? null,
        targetLabel: item.targetLabel,
        rating: item.rating,
      })),
      ...(platformFeedback !== undefined
        ? {
            platformFeedback: platformFeedback
              ? {
                  id: platformFeedback.id.toString(),
                  rating: platformFeedback.rating,
                  comment: platformFeedback.comment,
                  createdAt: platformFeedback.createdAt,
                  updatedAt: platformFeedback.updatedAt,
                }
              : null,
          }
        : {}),
    };
  }

  static itemToDomain(raw: any): ReviewItem {
    const targetIdVal = raw.targetId ?? raw.target_id;
    const bookingItemIdVal =
      raw.bookingServiceItemId ?? raw.booking_service_item_id;
    return ReviewItem.create(
      {
        reviewId: new UniqueEntityId(raw.reviewId ?? raw.review_id),
        bookingId: new UniqueEntityId(raw.bookingId ?? raw.booking_id),
        targetType: (raw.targetType ?? raw.target_type) as ReviewTargetType,
        targetKey: raw.targetKey ?? raw.target_key,
        targetId: targetIdVal ? new UniqueEntityId(targetIdVal) : null,
        bookingServiceItemId: bookingItemIdVal
          ? new UniqueEntityId(bookingItemIdVal)
          : null,
        targetLabel: raw.targetLabel ?? raw.target_label,
        rating: Number(raw.rating),
        createdAt: new Date(raw.createdAt ?? raw.created_at),
        updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static itemToPersistence(item: ReviewItem): any {
    return {
      id: item.id.toString(),
      reviewId: item.reviewId.toString(),
      bookingId: item.bookingId.toString(),
      targetType: item.targetType,
      targetKey: item.targetKey,
      targetId: item.targetId?.toString() ?? null,
      bookingServiceItemId: item.bookingServiceItemId?.toString() ?? null,
      targetLabel: item.targetLabel,
      rating: item.rating,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static platformFeedbackToDomain(raw: any): PlatformFeedback {
    const reviewIdVal = raw.reviewId ?? raw.review_id;
    return PlatformFeedback.create(
      {
        bookingId: new UniqueEntityId(raw.bookingId ?? raw.booking_id),
        reviewId: reviewIdVal ? new UniqueEntityId(reviewIdVal) : null,
        customerId: new UniqueEntityId(raw.customerId ?? raw.customer_id),
        rating:
          raw.rating !== null && raw.rating !== undefined
            ? Number(raw.rating)
            : null,
        comment: raw.comment ?? null,
        createdAt: new Date(raw.createdAt ?? raw.created_at),
        updatedAt: new Date(raw.updatedAt ?? raw.updated_at),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static platformFeedbackToPersistence(feedback: PlatformFeedback): any {
    return {
      id: feedback.id.toString(),
      bookingId: feedback.bookingId.toString(),
      reviewId: feedback.reviewId?.toString() ?? null,
      customerId: feedback.customerId.toString(),
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    };
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
      new UniqueEntityId(raw.id),
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
      new UniqueEntityId(raw.id),
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
