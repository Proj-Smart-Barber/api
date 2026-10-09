import { Resend } from "resend";
import type {
  EmailService,
  SendVerificationEmailParams,
} from "../../domain/application/services/email-service";
import { env } from "../env";
import { renderVerificationEmail } from "./render-verification-email";

export class ResendEmailService implements EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  async sendVerificationEmail(
    params: SendVerificationEmailParams,
  ): Promise<void> {
    const { html, text } = await renderVerificationEmail(params);

    const { error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: "Confirme seu e-mail no SmartBarber",
      html,
      text,
    });

    if (error) {
      throw new Error(`Falha ao enviar e-mail via Resend: ${error.message}`);
    }
  }
}
