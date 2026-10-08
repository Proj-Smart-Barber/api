export interface RequestPasswordResetDTO {
  email: string;
  /** Web ou deep link do app. */
  redirectTo?: string;
}
