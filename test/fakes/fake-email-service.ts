import type {
  EmailService,
  SendVerificationEmailParams,
} from "../../src/domain/application/services/email-service";

export class FakeEmailService implements EmailService {
  public sentEmails: SendVerificationEmailParams[] = [];
  public failNextSend = false;

  async sendVerificationEmail(
    params: SendVerificationEmailParams,
  ): Promise<void> {
    if (this.failNextSend) {
      this.failNextSend = false;

      throw new Error("Resend error: simulated delivery failure");
    }

    this.sentEmails.push(params);
  }
}
