import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export interface PlatformFeedbackProps {
  bookingId: UniqueEntityId;
  reviewId: UniqueEntityId | null;
  customerId: UniqueEntityId;
  rating: number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PlatformFeedback extends Entity<PlatformFeedbackProps> {
  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
  }

  get reviewId(): UniqueEntityId | null {
    return this.props.reviewId;
  }

  get customerId(): UniqueEntityId {
    return this.props.customerId;
  }

  get rating(): number | null {
    return this.props.rating;
  }

  get comment(): string | null {
    return this.props.comment;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static validate(
    rating: number | null | undefined,
    comment: string | null | undefined,
  ): string | null {
    if (rating !== undefined && rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error(
          "A nota da plataforma deve ser um número inteiro entre 1 e 5.",
        );
      }
    }
    const normalizedComment = comment?.trim() ? comment.trim() : null;
    if (normalizedComment && normalizedComment.length > 1000) {
      throw new Error(
        "O feedback para a plataforma deve ter no máximo 1000 caracteres.",
      );
    }
    if ((rating === undefined || rating === null) && !normalizedComment) {
      throw new Error(
        "Informe uma nota ou comentário para o feedback da plataforma.",
      );
    }
    return normalizedComment;
  }

  static create(
    props: Optional<
      PlatformFeedbackProps,
      "createdAt" | "updatedAt" | "reviewId" | "rating" | "comment"
    >,
    id?: UniqueEntityId,
  ): PlatformFeedback {
    const normalizedComment = PlatformFeedback.validate(
      props.rating,
      props.comment,
    );
    const now = new Date();
    return new PlatformFeedback(
      {
        bookingId: props.bookingId,
        reviewId: props.reviewId ?? null,
        customerId: props.customerId,
        rating: props.rating ?? null,
        comment: normalizedComment,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now,
      },
      id,
    );
  }
}
