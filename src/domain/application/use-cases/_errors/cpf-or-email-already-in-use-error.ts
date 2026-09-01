import type { UseCaseError } from "@/core/errors/use-case-error";

export class CPFOrEmailAlreadyInUseError extends Error implements UseCaseError {
  constructor() {
    super("O CPF ou o E-mail já está em uso.");
    this.name = "CPFOrEmailAlreadyInUseError";
  }
}
