import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export type ReviewTargetType = "BARBERSHOP" | "BARBER" | "SERVICE";

export interface ReviewItemProps {
  reviewId: UniqueEntityId;
  bookingId: UniqueEntityId;
  targetType: ReviewTargetType;
  targetKey: string;
  targetId: UniqueEntityId | null;
  bookingServiceItemId: UniqueEntityId | null;
  targetLabel: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewItem extends Entity<ReviewItemProps> {
  get reviewId(): UniqueEntityId {
    return this.props.reviewId;
  }

  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
  }

  get targetType(): ReviewTargetType {
    return this.props.targetType;
  }

  get targetKey(): string {
    return this.props.targetKey;
  }

  get targetId(): UniqueEntityId | null {
    return this.props.targetId;
  }

  get bookingServiceItemId(): UniqueEntityId | null {
    return this.props.bookingServiceItemId;
  }

  get targetLabel(): string {
    return this.props.targetLabel;
  }

  get rating(): number {
    return this.props.rating;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error(
        "A nota de avaliação deve ser um número inteiro entre 1 e 5.",
      );
    }
  }

  static buildTargetKey(params: {
    targetType: ReviewTargetType;
    targetId?: string | null;
    bookingServiceItemId?: string | null;
    fallbackIndex?: number;
  }): string {
    if (params.targetType === "BARBERSHOP" && params.targetId) {
      return `BARBERSHOP:${params.targetId}`;
    }
    if (params.targetType === "BARBER" && params.targetId) {
      return `BARBER:${params.targetId}`;
    }
    if (params.bookingServiceItemId) {
      return `SERVICE_ITEM:${params.bookingServiceItemId}`;
    }
    if (params.targetId) {
      return `SERVICE:${params.targetId}`;
    }
    return `SERVICE_SNAPSHOT:${params.fallbackIndex ?? 0}`;
  }

  static create(
    props: Optional<
      ReviewItemProps,
      "createdAt" | "updatedAt" | "targetId" | "bookingServiceItemId"
    >,
    id?: UniqueEntityId,
  ): ReviewItem {
    ReviewItem.validateRating(props.rating);
    const label = props.targetLabel.trim();
    if (!label) {
      throw new Error("O rótulo do alvo avaliado é obrigatório.");
    }
    if (!props.targetKey.trim()) {
      throw new Error("A chave do alvo avaliado é obrigatória.");
    }

    const now = new Date();
    return new ReviewItem(
      {
        ...props,
        targetId: props.targetId ?? null,
        bookingServiceItemId: props.bookingServiceItemId ?? null,
        targetLabel: label,
        targetKey: props.targetKey.trim(),
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now,
      },
      id,
    );
  }
}
