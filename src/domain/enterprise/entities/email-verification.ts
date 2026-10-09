import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

interface EmailVerificationProps {
  userId: UniqueEntityId;
  tokenHash: string;
  expiresAt: Date;
  createdAt?: Date;
  usedAt?: Date | null;
}

export class EmailVerification extends Entity<EmailVerificationProps> {
  get userId(): UniqueEntityId {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get usedAt(): Date | null | undefined {
    return this.props.usedAt;
  }

  isUsed(): boolean {
    return !!this.props.usedAt;
  }

  isExpired(reference: Date = new Date()): boolean {
    return this.props.expiresAt.getTime() <= reference.getTime();
  }

  isValid(reference: Date = new Date()): boolean {
    return !this.isUsed() && !this.isExpired(reference);
  }

  markAsUsed(at: Date = new Date()): void {
    this.props.usedAt = at;
  }

  static create(
    props: Optional<EmailVerificationProps, "createdAt" | "usedAt">,
    id?: UniqueEntityId,
  ) {
    const emailVerification = new EmailVerification(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
        usedAt: props.usedAt ?? null,
      },
      id,
    );

    return emailVerification;
  }
}
