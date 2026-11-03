import { createHmac, randomInt } from "node:crypto";
import { env } from "../../../infra/env";

export const EMAIL_CODE_TTL_MINUTES = 10;
export const EMAIL_CODE_RESEND_SECONDS = 60;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_CODE_MAX_SENDS_PER_HOUR = 5;

export function hashEmailVerificationCode(
  userId: string,
  code: string,
): string {
  // A short numeric code cannot be safely protected with an unkeyed digest alone.
  return createHmac(
    "sha256",
    env.EMAIL_VERIFICATION_CODE_SECRET ?? env.JWT_SECRET,
  )
    .update(`email-verification-code:v1:${userId}:${code}`)
    .digest("hex");
}

export function createEmailVerificationCode(userId: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return {
    code,
    codeHash: hashEmailVerificationCode(userId, code),
    expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
  };
}
