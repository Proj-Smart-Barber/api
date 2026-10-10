import { and, eq, isNull } from "drizzle-orm";
import type { EmailVerificationsRepository } from "../../../domain/application/repositories/email-verifications-repository";
import { EmailVerificationMapper } from "../../../domain/enterprise/mappers/email-verification-mapper";
import type { EmailVerification } from "../../../domain/enterprise/entities/email-verification";
import { db } from "..";
import { emailVerifications } from "../schema";

export class DrizzleEmailVerificationsRepository
  implements EmailVerificationsRepository
{
  async create(verification: EmailVerification): Promise<EmailVerification> {
    const [createdVerification] = await db
      .insert(emailVerifications)
      .values(EmailVerificationMapper.toPersistence(verification))
      .returning();

    return EmailVerificationMapper.toDomain(createdVerification);
  }

  async save(verification: EmailVerification): Promise<EmailVerification> {
    const [updatedVerification] = await db
      .update(emailVerifications)
      .set(EmailVerificationMapper.toPersistence(verification))
      .where(eq(emailVerifications.id, verification.id.toString()))
      .returning();

    return EmailVerificationMapper.toDomain(updatedVerification);
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerification | null> {
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.tokenHash, tokenHash));

    if (!verification) {
      return null;
    }

    return EmailVerificationMapper.toDomain(verification);
  }

  async invalidateActiveByUserId(userId: string): Promise<void> {
    await db
      .update(emailVerifications)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerifications.userId, userId),
          isNull(emailVerifications.usedAt),
        ),
      );
  }
}
