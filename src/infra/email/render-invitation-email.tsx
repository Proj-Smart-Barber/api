import { render, toPlainText } from "react-email";
import type { SendInvitationEmailParams } from "../../domain/application/services/email-service";
import { InvitationEmail } from "./templates/invitation-email";

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderInvitationEmail(
  params: SendInvitationEmailParams,
): Promise<RenderedEmail> {
  const html = await render(
    <InvitationEmail
      ownerName={params.ownerName}
      barbershopName={params.barbershopName}
      invitationUrl={params.invitationUrl}
      expiresInDays={params.expiresInDays}
    />,
  );
  const text = await toPlainText(html);

  return { html, text };
}
