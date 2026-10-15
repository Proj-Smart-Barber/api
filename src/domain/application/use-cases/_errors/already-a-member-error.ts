import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class AlreadyAMemberError extends Error implements UseCaseError {
  public readonly code = "ALREADY_A_MEMBER";

  constructor() {
    super("O usuário já faz parte desta barbearia.");
    this.name = "AlreadyAMemberError";
  }
}
