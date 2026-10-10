import { render, toPlainText } from "react-email";
import type { SendVerificationEmailParams } from "../../domain/application/services/email-service";
import { VerificationEmail } from "./templates/verification-email";

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderVerificationEmail(
  params: SendVerificationEmailParams,
): Promise<RenderedEmail> {
  const html = await render(
    <VerificationEmail
      name={params.name}
      verificationUrl={params.verificationUrl}
      expiresInHours={params.expiresInHours}
    />,
  );
  const text = await toPlainText(html);

  return { html, text };
}
