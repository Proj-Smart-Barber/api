import { Entity } from "../../../core/entities/Entity";
import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

interface RefreshTokenProps {
  userId: UniqueEntityId;
  tokenHash: string;
  familyId: UniqueEntityId;
  expiresAt: Date;
  createdAt?: Date;
  revokedAt?: Date | null;
  replacedByTokenId?: UniqueEntityId | null;
}

export class RefreshToken extends Entity<RefreshTokenProps> {
  get userId(): UniqueEntityId {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get familyId(): UniqueEntityId {
    return this.props.familyId;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get revokedAt(): Date | null | undefined {
    return this.props.revokedAt;
  }

  get replacedByTokenId(): UniqueEntityId | null | undefined {
    return this.props.replacedByTokenId;
  }

  isRevoked(): boolean {
    return !!this.props.revokedAt;
  }

  isExpired(reference: Date = new Date()): boolean {
    return this.props.expiresAt.getTime() <= reference.getTime();
  }

  revoke(replacedByTokenId?: UniqueEntityId): void {
    this.props.revokedAt = new Date();

    if (replacedByTokenId) {
      this.props.replacedByTokenId = replacedByTokenId;
    }
  }

  static create(
    props: Optional<
      RefreshTokenProps,
      "createdAt" | "revokedAt" | "replacedByTokenId"
    >,
    id?: UniqueEntityId,
  ) {
    const refreshToken = new RefreshToken(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
        revokedAt: props.revokedAt ?? null,
        replacedByTokenId: props.replacedByTokenId ?? null,
      },
      id,
    );

    return refreshToken;
  }
}
