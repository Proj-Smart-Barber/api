import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class AccountAlreadyExistsError extends Error implements UseCaseError {
  public readonly code = "account_already_exists";

  constructor(
    message = "Esta conta já existe. Entre com suas credenciais para aceitar o convite.",
  ) {
    super(message);
    this.name = "AccountAlreadyExistsError";
  }
}
