import type { UseCaseError } from "../../../../core/errors/use-case-error";

export interface ConflictingCustomSchedule {
  barbermanId: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
}

export class ScheduleCustomConflictError extends Error implements UseCaseError {
  readonly code = "SCHEDULE_CUSTOM_CONFLICT";
  readonly conflictingSchedules: ConflictingCustomSchedule[];

  constructor(conflictingSchedules: ConflictingCustomSchedule[]) {
    super(
      "A alteração da jornada geral entra em conflito com jornadas individuais customizadas de profissionais da unidade.",
    );
    this.name = "ScheduleCustomConflictError";
    this.conflictingSchedules = conflictingSchedules;
  }

  get conflictingBarbers(): ConflictingCustomSchedule[] {
    return this.conflictingSchedules;
  }
}
