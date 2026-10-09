import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class WeakPasswordError extends Error implements UseCaseError {
  constructor() {
    super("A nova senha deve ter pelo menos 8 caracteres.");
    this.name = "WeakPasswordError";
  }
}
