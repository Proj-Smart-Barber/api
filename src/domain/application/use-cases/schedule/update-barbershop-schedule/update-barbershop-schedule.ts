import { type Either, left, right } from "@/core/logic/either";
import type { SchedulesRepository } from "@/domain/application/repositories/schedules-repository";
import type { BarbershopsRepository } from "@/domain/application/repositories/barbershops-repository";
import { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

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
  ResourceNotFoundError | NotAllowedError | Error,
  { schedules: BarbershopSchedule[] }
>;

export class UpdateBarbershopScheduleUseCase {
  constructor(
    private schedulesRepository: SchedulesRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    barbershopId,
    barbermanId,
    createdBy,
    schedules,
  }: UpdateBarbershopScheduleDTO): Promise<UpdateBarbershopScheduleResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError());
    }

    if (barbershop.ownerId.toString() !== createdBy) {
      return left(new NotAllowedError());
    }

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
