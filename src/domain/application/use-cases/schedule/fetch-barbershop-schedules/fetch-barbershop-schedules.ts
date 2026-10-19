import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import type { ScheduleScopeState } from "../../../../enterprise/entities/barbershop-schedule-scope";
import { type Either, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { EffectiveScheduleResolver } from "../../../services/effective-schedule-resolver";

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

    const generalScope = await this.schedulesRepository.findScope(
      barbershopId,
      null,
    );
    const generalScopeState: ScheduleScopeState | null =
      generalScope?.state ?? null;

    if (!barbermanId) {
      const state: ScheduleScopeState = generalScope
        ? generalScope.state
        : generalSchedules.length === 0
          ? "CLOSED"
          : "CUSTOM";
      const version = generalScope ? generalScope.version : 1;
      const effectiveGeneral = state === "CLOSED" ? [] : generalSchedules;

      return right({
        schedules: state === "CLOSED" ? [] : generalSchedules,
        effectiveSchedules: effectiveGeneral,
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
        effectiveSchedules =
          generalScopeState === "CLOSED" ? [] : generalSchedules;
      } else if (scope.state === "CLOSED") {
        schedulesToReturn = [];
        effectiveSchedules = [];
      } else {
        schedulesToReturn = barbermanSchedules;
        effectiveSchedules = this.computeEffectiveCustomSchedules(
          barbermanSchedules,
          generalSchedules,
          barbershopId,
          barbermanId,
          generalScopeState,
        );
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

    // Caso de legado ambíguo: se possui jornadas próprias, é CUSTOM delimitado pelo geral
    if (barbermanSchedules.length > 0) {
      const effectiveSchedules = this.computeEffectiveCustomSchedules(
        barbermanSchedules,
        generalSchedules,
        barbershopId,
        barbermanId,
        generalScopeState,
      );

      return right({
        schedules: barbermanSchedules,
        effectiveSchedules,
        state: "CUSTOM",
        version: 1,
        needsReview: false,
        serverTime,
      });
    }

    // Caso de legado ambíguo sem jornadas individuais:
    // Não abre horários automaticamente. Trata como CLOSED e sinaliza necessidade de revisão explícita.
    return right({
      schedules: [],
      effectiveSchedules: [],
      state: "CLOSED",
      version: 1,
      needsReview: true,
      serverTime,
    });
  }

  private computeEffectiveCustomSchedules(
    barberSchedules: BarbershopSchedule[],
    generalSchedules: BarbershopSchedule[],
    barbershopId: string,
    barbermanId: string,
    generalScopeState?: ScheduleScopeState | null,
  ): BarbershopSchedule[] {
    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    const effective: BarbershopSchedule[] = [];

    for (const day of days) {
      const { intervals } =
        EffectiveScheduleResolver.resolveEffectiveDayIntervals({
          dayOfWeek: day,
          allSchedules: [...generalSchedules, ...barberSchedules],
          barbermanId,
          scopeState: "CUSTOM",
          generalScopeState,
        });

      for (const interval of intervals) {
        effective.push(
          BarbershopSchedule.create({
            barbershopId: new UniqueEntityId(barbershopId),
            barbermanId: new UniqueEntityId(barbermanId),
            dayOfWeek: day,
            openTime: interval.openTime,
            closeTime: interval.closeTime,
            createdBy: new UniqueEntityId(barbermanId),
          }),
        );
      }
    }

    return effective;
  }
}
