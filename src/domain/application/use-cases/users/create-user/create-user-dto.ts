export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phoneNumber?: string;
  /** URL de retorno após confirmação de e-mail (web ou deep link). */
  callbackURL?: string;
}
