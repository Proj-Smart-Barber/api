import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class IdentityConflictError extends Error implements UseCaseError {
  public readonly code = "IDENTITY_CONFLICT";

  constructor(
    message = "Os dados informados conflitam com um cadastro existente. Verifique os dados informados.",
  ) {
    super(message);
    this.name = "IdentityConflictError";
  }
}
