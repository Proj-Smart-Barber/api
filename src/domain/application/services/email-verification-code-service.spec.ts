import { describe, expect, it } from "vitest";
import {
  createEmailVerificationCode,
  hashEmailVerificationCode,
} from "./email-verification-code-service";
describe("Email verification numeric code", () => {
  it("generates a six-digit code, keyed hash and ten-minute expiration", () => {
    const start = Date.now();
    const issued = createEmailVerificationCode("user-a");
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(issued.codeHash).toHaveLength(64);
    expect(issued.codeHash).toBe(
      hashEmailVerificationCode("user-a", issued.code),
    );
    expect(issued.expiresAt.getTime() - start).toBeGreaterThanOrEqual(600000);
    expect(issued.expiresAt.getTime() - start).toBeLessThan(601000);
  });
  it("binds the same code to its account and preserves leading zeroes", () => {
    expect(hashEmailVerificationCode("user-a", "001234")).not.toBe(
      hashEmailVerificationCode("user-b", "001234"),
    );
    expect(hashEmailVerificationCode("user-a", "001234")).not.toBe(
      hashEmailVerificationCode("user-a", "1234"),
    );
  });
});
