import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { EmailVerificationCodesRepository } from "../../../domain/application/repositories/email-verification-codes-repository";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_MAX_SENDS_PER_HOUR,
  EMAIL_CODE_RESEND_SECONDS,
} from "../../../domain/application/services/email-verification-code-service";
import { db } from "../index";
import { emailVerificationCodes, emailVerifications, users } from "../schema";

export class DrizzleEmailVerificationCodesRepository
  implements EmailVerificationCodesRepository
{
  constructor(private customDatabase?: Pick<typeof db, "transaction">) {}
  private get database() {
    return this.customDatabase ?? db;
  }

  async issue(input: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<"issued" | "throttled" | "collision"> {
    return this.database.transaction(async (tx) => {
      // Issuance and consumption share the user-row lock across all API instances.
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .for("update");
      if (!user || user.emailVerifiedAt) return "throttled";
      const recent = await tx
        .select()
        .from(emailVerificationCodes)
        .where(
          and(
            eq(emailVerificationCodes.userId, input.userId),
            gte(
              emailVerificationCodes.createdAt,
              new Date(Date.now() - 3_600_000),
            ),
          ),
        )
        .orderBy(desc(emailVerificationCodes.createdAt));
      if (
        recent.length >= EMAIL_CODE_MAX_SENDS_PER_HOUR ||
        (recent[0] &&
          Date.now() - recent[0].createdAt.getTime() <
            EMAIL_CODE_RESEND_SECONDS * 1000)
      )
        return "throttled";
      if (recent.some((row) => row.codeHash === input.codeHash))
        return "collision";
      await tx
        .update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationCodes.userId, input.userId),
            isNull(emailVerificationCodes.usedAt),
          ),
        );
      await tx
        .update(emailVerifications)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerifications.userId, input.userId),
            isNull(emailVerifications.usedAt),
          ),
        );
      await tx.insert(emailVerificationCodes).values(input);
      return "issued";
    });
  }

  async confirm(userId: string, codeHash: string) {
    return this.database.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!user || user.emailVerifiedAt) return null;
      const [code] = await tx
        .select()
        .from(emailVerificationCodes)
        .where(eq(emailVerificationCodes.userId, userId))
        .orderBy(desc(emailVerificationCodes.createdAt))
        .limit(1)
        .for("update");
      if (
        !code ||
        code.usedAt ||
        code.expiresAt.getTime() <= Date.now() ||
        code.attempts >= EMAIL_CODE_MAX_ATTEMPTS
      )
        return null;
      const a = Buffer.from(code.codeHash, "hex");
      const b = Buffer.from(codeHash, "hex");
      if (a.length !== 32 || b.length !== 32 || !timingSafeEqual(a, b)) {
        await tx
          .update(emailVerificationCodes)
          .set({ attempts: sql`${emailVerificationCodes.attempts} + 1` })
          .where(eq(emailVerificationCodes.id, code.id));
        return null;
      }
      const now = new Date();
      await tx
        .update(emailVerificationCodes)
        .set({ usedAt: now })
        .where(eq(emailVerificationCodes.id, code.id));
      await tx
        .update(emailVerifications)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailVerifications.userId, userId),
            isNull(emailVerifications.usedAt),
          ),
        );
      await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, userId));
      return {
        userId,
        email: user.email,
        emailVerifiedAt: now,
        alreadyVerified: false,
      };
    });
  }

  async revoke(userId: string, codeHash: string) {
    await this.database.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      await tx
        .update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationCodes.userId, userId),
            eq(emailVerificationCodes.codeHash, codeHash),
            isNull(emailVerificationCodes.usedAt),
          ),
        );
    });
  }

  async confirmLegacy(tokenHash: string) {
    return this.database.transaction(async (tx) => {
      const [reference] = await tx
        .select({ userId: emailVerifications.userId })
        .from(emailVerifications)
        .where(eq(emailVerifications.tokenHash, tokenHash));
      if (!reference) return null;
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, reference.userId))
        .for("update");
      const [token] = await tx
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.userId, reference.userId),
            eq(emailVerifications.tokenHash, tokenHash),
          ),
        )
        .for("update");
      if (!user || !token) return null;
      if (user.emailVerifiedAt)
        return {
          userId: user.id,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          alreadyVerified: true,
        };
      if (token.usedAt || token.expiresAt.getTime() <= Date.now()) return null;
      const now = new Date();
      await tx
        .update(emailVerifications)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailVerifications.userId, user.id),
            isNull(emailVerifications.usedAt),
          ),
        );
      await tx
        .update(emailVerificationCodes)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailVerificationCodes.userId, user.id),
            isNull(emailVerificationCodes.usedAt),
          ),
        );
      await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, user.id));
      return {
        userId: user.id,
        email: user.email,
        emailVerifiedAt: now,
        alreadyVerified: false,
      };
    });
  }
}
