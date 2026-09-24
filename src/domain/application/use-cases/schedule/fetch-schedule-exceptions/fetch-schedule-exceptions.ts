import type { ScheduleExceptionsRepository } from "@/domain/application/repositories/schedule-exceptions-repository";
import type { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";
import { type Either, right } from "@/core/logic/either";

interface FetchScheduleExceptionsUseCaseRequest {
  barbershopId: string;
  barbermanId?: string | null;
}

type FetchScheduleExceptionsUseCaseResponse = Either<
  null,
  {
    exceptions: ScheduleException[];
  }
>;

export class FetchScheduleExceptionsUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
  ) {}

  async execute({
    barbershopId,
    barbermanId,
  }: FetchScheduleExceptionsUseCaseRequest): Promise<FetchScheduleExceptionsUseCaseResponse> {
    let exceptions =
      await this.scheduleExceptionsRepository.findManyByBarbershopId(
        barbershopId,
      );

    if (barbermanId) {
      exceptions = exceptions.filter(
        (exception) => exception.barbermanId?.toString() === barbermanId,
      );
    }

    return right({
      exceptions,
    });
  }
}
