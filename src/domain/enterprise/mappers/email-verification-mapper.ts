import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { emailVerifications } from "../../../infra/drizzle/schema";
import { EmailVerification } from "../entities/email-verification";

type PersistenceEmailVerification = InferSelectModel<typeof emailVerifications>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class EmailVerificationMapper {
  static toDomain(raw: PersistenceEmailVerification) {
    return EmailVerification.create(
      {
        userId: new UniqueEntityId(raw.userId),
        tokenHash: raw.tokenHash,
        expiresAt: raw.expiresAt,
        createdAt: raw.createdAt ?? new Date(),
        usedAt: raw.usedAt ?? null,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(emailVerification: EmailVerification) {
    return {
      id: emailVerification.id.toString(),
      userId: emailVerification.userId.toString(),
      tokenHash: emailVerification.tokenHash,
      expiresAt: emailVerification.expiresAt,
      createdAt: emailVerification.createdAt ?? new Date(),
      usedAt: emailVerification.usedAt ?? null,
    };
  }
}
