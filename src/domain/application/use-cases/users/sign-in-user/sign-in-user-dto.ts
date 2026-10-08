export interface SignInUserDTO {
  email: string;
  password: string;
  /** URL de retorno após confirmação de e-mail (web ou deep link). */
  callbackURL?: string;
}
