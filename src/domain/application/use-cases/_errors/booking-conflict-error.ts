import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class BookingConflictError extends Error implements UseCaseError {
  constructor(message?: string) {
    super(message || "Horário indisponível devido a um conflito na agenda.");
  }
}
