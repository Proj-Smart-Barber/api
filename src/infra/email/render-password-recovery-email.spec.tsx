import { renderPasswordRecoveryEmail } from "./render-password-recovery-email";

describe("renderPasswordRecoveryEmail", () => {
  it("renders HTML containing the recovery link and user data", async () => {
    const recoveryUrl =
      "https://app.smartbarber.com/reset-password?token=abc123";

    const { html, text } = await renderPasswordRecoveryEmail({
      to: "fulano@email.com",
      name: "Fulano",
      recoveryUrl,
      expiresInHours: 1,
    });

    expect(html).toContain("Fulano");
    expect(html).toContain("Redefinir senha");
    expect(html).toContain(recoveryUrl);
    expect(text).toContain(recoveryUrl);
  });
});
