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

export interface EmailService {
  sendVerificationEmail(params: SendVerificationEmailParams): Promise<void>;
  sendPasswordRecoveryEmail(
    params: SendPasswordRecoveryEmailParams,
  ): Promise<void>;
}
