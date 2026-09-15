import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class BookingConflictError extends Error implements UseCaseError {
  constructor() {
    super("Horário indisponível devido a um conflito na agenda.");
  }
}
