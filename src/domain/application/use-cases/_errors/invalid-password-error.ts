import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class InvalidPasswordError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message ?? "Senha atual incorreta.");
    this.name = "InvalidPasswordError";
  }
}
