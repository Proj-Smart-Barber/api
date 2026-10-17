import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class ScheduleVersionConflictError
  extends Error
  implements UseCaseError
{
  readonly code = "SCHEDULE_VERSION_CONFLICT";

  constructor(
    message = "A versão informada não coincide com a versão atual da jornada. Recarregue os dados e tente novamente.",
  ) {
    super(message);
    this.name = "ScheduleVersionConflictError";
  }
}
