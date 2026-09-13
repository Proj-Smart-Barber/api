import { type Either, left, right } from "@/core/logic/either";
import type { SchedulesRepository } from "@/domain/application/repositories/schedules-repository";
import { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

interface UpdateBarbershopScheduleDTO {
  barbershopId: string;
  barbermanId: string | null;
  createdBy: string;
  schedules: Array<{
    dayOfWeek: string;
    openTime: string;
    closeTime: string;
  }>;
}

type UpdateBarbershopScheduleResponse = Either<
  Error,
  { schedules: BarbershopSchedule[] }
>;

export class UpdateBarbershopScheduleUseCase {
  constructor(private schedulesRepository: SchedulesRepository) {}

  async execute({
    barbershopId,
    barbermanId,
    createdBy,
    schedules,
  }: UpdateBarbershopScheduleDTO): Promise<UpdateBarbershopScheduleResponse> {
    const barbershopSchedules: BarbershopSchedule[] = [];

    for (const item of schedules) {
      if (item.openTime >= item.closeTime) {
        return left(
          new Error(
            "O horário de fechamento deve ser maior que o de abertura.",
          ),
        );
      }

      const schedule = BarbershopSchedule.create({
        barbershopId: new UniqueEntityId(barbershopId),
        createdBy: new UniqueEntityId(createdBy),
        dayOfWeek: item.dayOfWeek,
        openTime: item.openTime,
        closeTime: item.closeTime,
        barbermanId: barbermanId ? new UniqueEntityId(barbermanId) : null,
      });

      barbershopSchedules.push(schedule);
    }

    await this.schedulesRepository.bulkReplace(
      barbershopId,
      barbermanId,
      barbershopSchedules,
    );

    return right({ schedules: barbershopSchedules });
  }
}
