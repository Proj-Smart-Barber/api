import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import type { ScheduleScopeState } from "../../../../enterprise/entities/barbershop-schedule-scope";
import { type Either, right } from "../../../../../core/logic/either";

export interface FetchBarbershopSchedulesUseCaseRequest {
  barbershopId: string;
  barbermanId?: string | null;
}

export interface FetchBarbershopSchedulesUseCaseSuccess {
  schedules: BarbershopSchedule[];
  effectiveSchedules: BarbershopSchedule[];
  state: ScheduleScopeState;
  version: number;
  needsReview: boolean;
  serverTime: string;
}

export type FetchBarbershopSchedulesUseCaseResponse = Either<
  null,
  FetchBarbershopSchedulesUseCaseSuccess
>;

export class FetchBarbershopSchedulesUseCase {
  constructor(private schedulesRepository: SchedulesRepository) {}

  async execute({
    barbershopId,
    barbermanId,
  }: FetchBarbershopSchedulesUseCaseRequest): Promise<FetchBarbershopSchedulesUseCaseResponse> {
    const allSchedules =
      await this.schedulesRepository.findManyByBarbershopId(barbershopId);
    const generalSchedules = allSchedules.filter((s) => !s.barbermanId);
    const serverTime = new Date().toISOString();

    if (!barbermanId) {
      const scope = await this.schedulesRepository.findScope(
        barbershopId,
        null,
      );
      const state: ScheduleScopeState = scope
        ? scope.state
        : generalSchedules.length === 0
          ? "CLOSED"
          : "CUSTOM";
      const version = scope ? scope.version : 1;

      return right({
        schedules: generalSchedules,
        effectiveSchedules: generalSchedules,
        state,
        version,
        needsReview: false,
        serverTime,
      });
    }

    const barbermanSchedules = allSchedules.filter(
      (schedule) => schedule.barbermanId?.toString() === barbermanId,
    );
    const scope = await this.schedulesRepository.findScope(
      barbershopId,
      barbermanId,
    );

    if (scope) {
      let effectiveSchedules: BarbershopSchedule[] = [];
      let schedulesToReturn: BarbershopSchedule[] = [];

      if (scope.state === "INHERIT") {
        schedulesToReturn = [];
        effectiveSchedules = generalSchedules;
      } else if (scope.state === "CLOSED") {
        schedulesToReturn = [];
        effectiveSchedules = [];
      } else {
        schedulesToReturn = barbermanSchedules;
        effectiveSchedules = barbermanSchedules;
      }

      return right({
        schedules: schedulesToReturn,
        effectiveSchedules,
        state: scope.state,
        version: scope.version,
        needsReview: false,
        serverTime,
      });
    }

    // Caso de legado ambíguo: se possui jornadas próprias, é CUSTOM
    if (barbermanSchedules.length > 0) {
      return right({
        schedules: barbermanSchedules,
        effectiveSchedules: barbermanSchedules,
        state: "CUSTOM",
        version: 1,
        needsReview: false,
        serverTime,
      });
    }

    // Caso de legado ambíguo sem jornadas individuais: manter comportamento efetivo e sinalizar revisão
    return right({
      schedules: [],
      effectiveSchedules: generalSchedules,
      state: "INHERIT",
      version: 1,
      needsReview: true,
      serverTime,
    });
  }
}
