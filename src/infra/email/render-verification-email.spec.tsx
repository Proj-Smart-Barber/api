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
