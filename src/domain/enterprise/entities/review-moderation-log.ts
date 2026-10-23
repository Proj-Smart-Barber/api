import { Entity } from "../../../core/entities/Entity";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export type ModerationAction = "HIDE" | "RESTORE";

export interface ReviewModerationLogProps {
  reviewId: UniqueEntityId;
  adminId: UniqueEntityId;
  action: ModerationAction;
  reason: string;
  createdAt: Date;
}

export class ReviewModerationLog extends Entity<ReviewModerationLogProps> {
  get reviewId(): UniqueEntityId {
    return this.props.reviewId;
  }

  get adminId(): UniqueEntityId {
    return this.props.adminId;
  }

  get action(): ModerationAction {
    return this.props.action;
  }

  get reason(): string {
    return this.props.reason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(
    props: Optional<ReviewModerationLogProps, "createdAt">,
    id?: UniqueEntityId
  ): ReviewModerationLog {
    if (!props.reason || props.reason.trim().length === 0) {
      throw new Error("O motivo da ação de moderação é obrigatório.");
    }
    return new ReviewModerationLog(
      {
        ...props,
        reason: props.reason.trim(),
        createdAt: props.createdAt ?? new Date(),
      },
      id
    );
  }
}
