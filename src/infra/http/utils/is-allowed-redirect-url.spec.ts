import { env } from "../../env";
import { isAllowedRedirectUrl } from "./is-allowed-redirect-url";

describe("isAllowedRedirectUrl", () => {
  it("should accept relative paths from the same application", () => {
    expect(isAllowedRedirectUrl("/reset-password/abc")).toBe(true);
    expect(isAllowedRedirectUrl("/verify-email?token=abc")).toBe(true);
  });

  it("should reject protocol-relative urls", () => {
    expect(isAllowedRedirectUrl("//evil.com/phish")).toBe(false);
  });

  it("should accept the configured app url", () => {
    expect(isAllowedRedirectUrl(env.APP_URL)).toBe(true);
    expect(isAllowedRedirectUrl(`${env.APP_URL}/auth/done`)).toBe(true);
  });

  it("should accept the mobile deep link scheme", () => {
    expect(isAllowedRedirectUrl(`${env.APP_SCHEME}://auth/verify-email`)).toBe(
      true,
    );
    expect(
      isAllowedRedirectUrl(`${env.APP_SCHEME}://auth/reset-password`),
    ).toBe(true);
  });

  it("should reject unknown external urls", () => {
    expect(isAllowedRedirectUrl("https://evil.com/phish")).toBe(false);
    expect(isAllowedRedirectUrl("not a url")).toBe(false);
  });
});
