import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { type Either, right } from "../../../../../core/logic/either";

interface FetchBarbershopSchedulesUseCaseRequest {
  barbershopId: string;
  barbermanId?: string | null;
}

type FetchBarbershopSchedulesUseCaseResponse = Either<
  null,
  {
    schedules: BarbershopSchedule[];
  }
>;

export class FetchBarbershopSchedulesUseCase {
  constructor(private schedulesRepository: SchedulesRepository) {}

  async execute({
    barbershopId,
    barbermanId,
  }: FetchBarbershopSchedulesUseCaseRequest): Promise<FetchBarbershopSchedulesUseCaseResponse> {
    let schedules =
      await this.schedulesRepository.findManyByBarbershopId(barbershopId);

    if (barbermanId) {
      schedules = schedules.filter(
        (schedule) => schedule.barbermanId?.toString() === barbermanId,
      );
    }

    return right({
      schedules,
    });
  }
}
