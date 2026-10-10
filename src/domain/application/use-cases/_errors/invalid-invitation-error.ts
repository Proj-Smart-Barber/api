import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class InvalidInvitationError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message ?? "Convite inválido ou expirado.");
    this.name = "InvalidInvitationError";
  }
}
