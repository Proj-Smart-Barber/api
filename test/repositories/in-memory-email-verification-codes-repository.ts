import type { EmailVerificationCodesRepository } from "../../src/domain/application/repositories/email-verification-codes-repository";
import type { UsersRepository } from "../../src/domain/application/repositories/users-repository";
import type { EmailVerificationsRepository } from "../../src/domain/application/repositories/email-verifications-repository";

export class InMemoryEmailVerificationCodesRepository
  implements EmailVerificationCodesRepository
{
  items: Array<{
    userId: string;
    codeHash: string;
    expiresAt: Date;
    createdAt: Date;
    attempts: number;
    usedAt: Date | null;
  }> = [];
  constructor(
    private users: UsersRepository,
    private legacy?: EmailVerificationsRepository,
  ) {}
  async issue(input: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<"issued" | "throttled" | "collision"> {
    const user = await this.users.findById(input.userId);
    const recent = this.items.filter(
      (i) =>
        i.userId === input.userId &&
        i.createdAt.getTime() > Date.now() - 3_600_000,
    );
    if (
      !user ||
      user.isEmailVerified ||
      recent.length >= 5 ||
      recent.some((i) => Date.now() - i.createdAt.getTime() < 60000)
    )
      return "throttled";
    if (recent.some((i) => i.codeHash === input.codeHash)) return "collision";
    for (const item of this.items.filter(
      (i) => i.userId === input.userId && !i.usedAt,
    ))
      item.usedAt = new Date();
    this.items.push({
      ...input,
      createdAt: new Date(),
      usedAt: null,
      attempts: 0,
    });
    return "issued";
  }
  async confirm(userId: string, codeHash: string) {
    const user = await this.users.findById(userId);
    const record = this.items.filter((i) => i.userId === userId).at(-1);
    if (
      !user ||
      user.isEmailVerified ||
      !record ||
      record.usedAt ||
      record.expiresAt.getTime() <= Date.now() ||
      record.attempts >= 5
    )
      return null;
    if (record.codeHash !== codeHash) {
      record.attempts++;
      return null;
    }
    record.usedAt = new Date();
    user.verifyEmail(record.usedAt);
    await this.users.update(user);
    return {
      userId,
      email: user.email,
      emailVerifiedAt: record.usedAt,
      alreadyVerified: false,
    };
  }
  async revoke(userId: string, codeHash: string) {
    for (const item of this.items.filter(
      (i) => i.userId === userId && i.codeHash === codeHash && !i.usedAt,
    ))
      item.usedAt = new Date();
  }
  async confirmLegacy(tokenHash: string) {
    const token = await this.legacy?.findByTokenHash(tokenHash);
    if (!token) return null;
    const user = await this.users.findById(token.userId.toString());
    if (!user) return null;
    if (user.isEmailVerified)
      return {
        userId: user.id.toString(),
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt!,
        alreadyVerified: true,
      };
    if (!token.isValid()) return null;
    token.markAsUsed();
    await this.legacy!.save(token);
    const now = new Date();
    user.verifyEmail(now);
    await this.users.update(user);
    return {
      userId: user.id.toString(),
      email: user.email,
      emailVerifiedAt: now,
      alreadyVerified: false,
    };
  }
}
