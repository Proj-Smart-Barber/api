import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class InvalidPasswordRecoveryTokenError
  extends Error
  implements UseCaseError
{
  constructor() {
    super("Token de recuperação de senha inválido ou expirado.");
    this.name = "InvalidPasswordRecoveryTokenError";
  }
}
