import { renderVerificationEmail } from "./render-verification-email";

describe("renderVerificationEmail", () => {
  it("renders HTML containing the verification link and user data", async () => {
    const verificationUrl =
      "https://api.smartbarber.app/api/users/verification-email/confirm?token=abc123";

    const { html, text } = await renderVerificationEmail({
      to: "fulano@email.com",
      name: "Fulano",
      verificationUrl,
      expiresInHours: 24,
    });

    expect(html).toContain("Fulano");
    expect(html).toContain("Confirmar e-mail");
    expect(html).toContain(verificationUrl);
    expect(text).toContain(verificationUrl);
  });
});
import { describe, it, expect } from "vitest";

it("renders the numeric code in HTML and text without a confirmation link", async () => {
  const result = await renderVerificationEmail({
    to: "test@example.com",
    name: "Teste",
    verificationUrl: "",
    expiresInHours: 0,
    verificationCode: "001234",
    expiresInMinutes: 10,
  });
  expect(result.html).toContain("001234");
  expect(result.text).toContain("001234");
  expect(result.text).toContain("10 minutos");
  expect(result.html).not.toContain('href=""');
  expect(result.text).not.toContain("Confirmar e-mail");
});
