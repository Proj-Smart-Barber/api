import { type Either, left, right } from "@/core/logic/either";
import type { SchedulesRepository } from "@/domain/application/repositories/schedules-repository";
import { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

interface UpdateBarbershopScheduleDTO {
  barbershopId: string;
  createdBy: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  barbermanId?: string | null;
}

type UpdateBarbershopScheduleResponse = Either<
  Error,
  { schedule: BarbershopSchedule }
>;

export class UpdateBarbershopScheduleUseCase {
  constructor(private schedulesRepository: SchedulesRepository) {}

  async execute({
    barbershopId,
    createdBy,
    dayOfWeek,
    openTime,
    closeTime,
    barbermanId,
  }: UpdateBarbershopScheduleDTO): Promise<UpdateBarbershopScheduleResponse> {
    if (openTime >= closeTime) {
      return left(
        new Error("O horário de fechamento deve ser maior que o de abertura."),
      );
    }

    const schedule = BarbershopSchedule.create({
      barbershopId: new UniqueEntityId(barbershopId),
      createdBy: new UniqueEntityId(createdBy),
      dayOfWeek,
      openTime,
      closeTime,
      barbermanId: barbermanId ? new UniqueEntityId(barbermanId) : null,
    });

    await this.schedulesRepository.create(schedule);

    return right({ schedule });
  }
}
