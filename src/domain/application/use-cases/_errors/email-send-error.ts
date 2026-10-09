import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class EmailSendError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message ?? "Não foi possível enviar o e-mail de verificação.");
    this.name = "EmailSendError";
  }
}
