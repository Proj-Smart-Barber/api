import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class InvalidVerificationTokenError
  extends Error
  implements UseCaseError
{
  constructor() {
    super("Código ou link de confirmação inválido, expirado ou já utilizado.");
    this.name = "InvalidVerificationTokenError";
  }
}
