import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class EmailNotVerifiedError extends Error implements UseCaseError {
  constructor() {
    super("E-mail ainda não verificado.");
    this.name = "EmailNotVerifiedError";
  }
}
