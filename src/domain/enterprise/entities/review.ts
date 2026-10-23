import { Entity } from "../../../core/entities/Entity";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export type ReviewStatus =
  | "PUBLISHED"
  | "HIDDEN_BY_MODERATION"
  | "DELETED_BY_AUTHOR";

export interface ReviewProps {
  bookingId: UniqueEntityId;
  barbershopId: UniqueEntityId;
  customerId: UniqueEntityId;
  rating: number;
  comment?: string;
  status: ReviewStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Review extends Entity<ReviewProps> {
  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
  }

  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get customerId(): UniqueEntityId {
    return this.props.customerId;
  }

  get rating(): number {
    return this.props.rating;
  }

  get comment(): string | undefined {
    return this.props.comment;
  }

  get status(): ReviewStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isPublished(): boolean {
    return this.props.status === "PUBLISHED";
  }

  update(params: { rating: number; comment?: string; expectedVersion?: number }): void {
    if (this.props.status === "HIDDEN_BY_MODERATION") {
      throw new Error("Esta avaliação foi ocultada pela moderação e não pode ser editada diretamente.");
    }

    if (params.expectedVersion !== undefined && params.expectedVersion !== this.props.version) {
      throw new Error("Conflito de versão na edição da avaliação.");
    }

    Review.validateRating(params.rating);
    Review.validateComment(params.comment);

    this.props.rating = params.rating;
    this.props.comment = params.comment;
    this.props.version += 1;
    this.touch();
  }

  deleteByAuthor(): void {
    this.props.status = "DELETED_BY_AUTHOR";
    this.props.version += 1;
    this.touch();
  }

  hideByModeration(): void {
    this.props.status = "HIDDEN_BY_MODERATION";
    this.props.version += 1;
    this.touch();
  }

  restoreByModeration(): void {
    if (this.props.status !== "HIDDEN_BY_MODERATION") {
      throw new Error(
        "Apenas avaliações ocultadas pela moderação podem ser restauradas. Avaliações removidas pelo autor não podem ser restauradas."
      );
    }
    this.props.status = "PUBLISHED";
    this.props.version += 1;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("A nota deve ser um número inteiro de 1 a 5.");
    }
  }

  private static validateComment(comment?: string): void {
    if (comment !== undefined && comment.length > 1000) {
      throw new Error("O comentário não pode exceder 1.000 caracteres.");
    }
  }

  static create(
    props: Optional<ReviewProps, "status" | "version" | "createdAt" | "updatedAt">,
    id?: UniqueEntityId
  ): Review {
    Review.validateRating(props.rating);
    Review.validateComment(props.comment);

    return new Review(
      {
        ...props,
        status: props.status ?? "PUBLISHED",
        version: props.version ?? 1,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id
    );
  }
}
