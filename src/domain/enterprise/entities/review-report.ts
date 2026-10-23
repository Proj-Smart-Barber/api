import { Entity } from "../../../core/entities/Entity";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export interface ReviewReportProps {
  reviewId: UniqueEntityId;
  reporterId: UniqueEntityId;
  reason: string;
  createdAt: Date;
}

export class ReviewReport extends Entity<ReviewReportProps> {
  get reviewId(): UniqueEntityId {
    return this.props.reviewId;
  }

  get reporterId(): UniqueEntityId {
    return this.props.reporterId;
  }

  get reason(): string {
    return this.props.reason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(
    props: Optional<ReviewReportProps, "createdAt">,
    id?: UniqueEntityId
  ): ReviewReport {
    if (!props.reason || props.reason.trim().length === 0) {
      throw new Error("O motivo da denúncia é obrigatório.");
    }
    return new ReviewReport(
      {
        ...props,
        reason: props.reason.trim(),
        createdAt: props.createdAt ?? new Date(),
      },
      id
    );
  }
}
