import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class TooManyRequestsError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message ?? "Muitas tentativas. Tente novamente em instantes.");
    this.name = "TooManyRequestsError";
  }
}
