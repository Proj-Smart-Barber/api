import { Resend } from "resend";
import { env } from "../env";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Transporte de e-mail (Resend). Sem RESEND_API_KEY (dev/local) o link é
 * apenas logado, permitindo validar os fluxos sem infraestrutura real.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      [
        "[Email] RESEND_API_KEY não configurada — e-mail não enviado.",
        `Para: ${input.to}`,
        `Assunto: ${input.subject}`,
        input.text,
      ].join("\n"),
    );
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.EMAIL_FROM ?? "SmartBarber <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (error) {
    console.error("[Email] Falha ao enviar e-mail:", error);
  }
}
