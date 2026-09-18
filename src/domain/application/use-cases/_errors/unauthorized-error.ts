import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class UnauthorizedError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message ?? "Não autorizado.");
    this.name = "UnauthorizedError";
  }
}
