import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class WeakPasswordError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message ?? "A senha não atende aos requisitos mínimos.");
    this.name = "WeakPasswordError";
  }
}
