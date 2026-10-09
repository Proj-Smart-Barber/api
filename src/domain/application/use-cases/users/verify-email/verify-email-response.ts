export interface VerifyEmailResponse {
  userId: string;
  email: string;
  emailVerifiedAt: Date;
  alreadyVerified: boolean;
}
