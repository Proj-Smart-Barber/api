import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class BookingNotFoundError extends Error implements UseCaseError {
  constructor() {
    super("Agendamento não encontrado.");
  }
}
