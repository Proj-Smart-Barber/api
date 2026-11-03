import type { VerifyEmailResponse } from "../use-cases/users/verify-email/verify-email-response";

export interface EmailVerificationCodesRepository {
  issue(input: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<"issued" | "throttled" | "collision">;
  confirm(
    userId: string,
    codeHash: string,
  ): Promise<VerifyEmailResponse | null>;
  confirmLegacy(tokenHash: string): Promise<VerifyEmailResponse | null>;
  revoke(userId: string, codeHash: string): Promise<void>;
}
