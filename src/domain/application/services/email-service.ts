export interface SendVerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
  expiresInHours: number;
}

export interface SendPasswordRecoveryEmailParams {
  to: string;
  name: string;
  recoveryUrl: string;
  expiresInHours: number;
}

export interface SendInvitationEmailParams {
  to: string;
  ownerName: string;
  barbershopName: string;
  invitationUrl: string;
  expiresInDays: number;
}

export interface EmailService {
  sendVerificationEmail(params: SendVerificationEmailParams): Promise<void>;
  sendPasswordRecoveryEmail(
    params: SendPasswordRecoveryEmailParams,
  ): Promise<void>;
  sendInvitationEmail(params: SendInvitationEmailParams): Promise<void>;
}
