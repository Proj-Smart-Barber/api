import type { EmailVerification } from "../../enterprise/entities/email-verification";

export interface EmailVerificationsRepository {
  create(verification: EmailVerification): Promise<EmailVerification>;
  save(verification: EmailVerification): Promise<EmailVerification>;
  findByTokenHash(tokenHash: string): Promise<EmailVerification | null>;
  invalidateActiveByUserId(userId: string): Promise<void>;
}
