export interface SendVerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
  expiresInHours: number;
}

export interface EmailService {
  sendVerificationEmail(params: SendVerificationEmailParams): Promise<void>;
}
