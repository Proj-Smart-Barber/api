export interface RequestEmailVerificationDTO {
  email: string;
  /** Web ou deep link do app. */
  callbackURL?: string;
}
