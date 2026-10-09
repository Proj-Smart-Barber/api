import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class InvalidVerificationTokenError
  extends Error
  implements UseCaseError
{
  constructor() {
    super("Token de verificação inválido ou expirado.");
    this.name = "InvalidVerificationTokenError";
  }
}
