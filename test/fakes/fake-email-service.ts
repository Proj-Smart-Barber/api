import type {
  EmailService,
  SendInvitationEmailParams,
  SendPasswordRecoveryEmailParams,
  SendVerificationEmailParams,
} from "../../src/domain/application/services/email-service";

export class FakeEmailService implements EmailService {
  public sentEmails: SendVerificationEmailParams[] = [];
  public recoveryEmails: SendPasswordRecoveryEmailParams[] = [];
  public invitationEmails: SendInvitationEmailParams[] = [];
  public failNextSend = false;

  async sendVerificationEmail(
    params: SendVerificationEmailParams,
  ): Promise<void> {
    this.assertCanSend();
    this.sentEmails.push(params);
  }

  async sendPasswordRecoveryEmail(
    params: SendPasswordRecoveryEmailParams,
  ): Promise<void> {
    this.assertCanSend();
    this.recoveryEmails.push(params);
  }

  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    this.assertCanSend();
    this.invitationEmails.push(params);
  }

  private assertCanSend(): void {
    if (this.failNextSend) {
      this.failNextSend = false;

      throw new Error("Resend error: simulated delivery failure");
    }
  }
}
