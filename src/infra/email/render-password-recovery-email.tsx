import { render, toPlainText } from "react-email";
import type { SendPasswordRecoveryEmailParams } from "../../domain/application/services/email-service";
import { PasswordRecoveryEmail } from "./templates/password-recovery-email";

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderPasswordRecoveryEmail(
  params: SendPasswordRecoveryEmailParams,
): Promise<RenderedEmail> {
  const html = await render(
    <PasswordRecoveryEmail
      name={params.name}
      recoveryUrl={params.recoveryUrl}
      expiresInHours={params.expiresInHours}
    />,
  );
  const text = await toPlainText(html);

  return { html, text };
}
