import type { EmailVerificationsRepository } from "../../src/domain/application/repositories/email-verifications-repository";
import type { EmailVerification } from "../../src/domain/enterprise/entities/email-verification";

export class InMemoryEmailVerificationsRepository
  implements EmailVerificationsRepository
{
  private verifications: EmailVerification[] = [];

  async create(verification: EmailVerification): Promise<EmailVerification> {
    this.verifications.push(verification);

    return verification;
  }

  async save(verification: EmailVerification): Promise<EmailVerification> {
    const index = this.verifications.findIndex(
      (item) => item.id.toString() === verification.id.toString(),
    );

    if (index >= 0) {
      this.verifications[index] = verification;
    }

    return verification;
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerification | null> {
    const verification = this.verifications.find(
      (item) => item.tokenHash === tokenHash,
    );

    return verification ?? null;
  }

  async invalidateActiveByUserId(userId: string): Promise<void> {
    for (const verification of this.verifications) {
      if (verification.userId.toString() === userId && !verification.isUsed()) {
        verification.markAsUsed();
      }
    }
  }

  get items(): EmailVerification[] {
    return this.verifications;
  }
}
