export type VerifyEmailDTO =
  | { token: string }
  | { email: string; code: string };
