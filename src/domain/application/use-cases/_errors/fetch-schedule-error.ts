import type { UseCaseError } from "@/core/errors/use-case-error";

export class FetchScheduleError extends Error implements UseCaseError {
  constructor() {
    super("Não foi possível carregar a agenda no momento.");
  }
}
