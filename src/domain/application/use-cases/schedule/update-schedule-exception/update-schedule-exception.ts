import { type Either, left, right } from "@/core/logic/either";
import type { ScheduleExceptionsRepository } from "@/domain/application/repositories/schedule-exceptions-repository";
import { ResourceNotFoundError } from "@/domain/application/use-cases/_errors/resource-not-found-error";
import { NotAllowedError } from "@/domain/application/use-cases/_errors/not-allowed-error";
import type { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";

interface UpdateScheduleExceptionDTO {
  exceptionId: string;
  barbershopId: string;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

type UpdateScheduleExceptionResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    scheduleException: ScheduleException;
  }
>;

export class UpdateScheduleExceptionUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
  ) {}

  async execute({
    exceptionId,
    barbershopId,
    date,
    startTime,
    endTime,
    reason,
  }: UpdateScheduleExceptionDTO): Promise<UpdateScheduleExceptionResponse> {
    const exception =
      await this.scheduleExceptionsRepository.findById(exceptionId);

    if (!exception) {
      return left(new ResourceNotFoundError());
    }

    if (exception.barbershopId.toString() !== barbershopId) {
      return left(new NotAllowedError());
    }

    if (date !== undefined) {
      exception.date = new Date(date);
    }

    if (startTime !== undefined) {
      exception.startTime = startTime;
    }

    if (endTime !== undefined) {
      exception.endTime = endTime;
    }

    if (reason !== undefined) {
      exception.reason = reason;
    }

    await this.scheduleExceptionsRepository.save(exception);

    return right({
      scheduleException: exception,
    });
  }
}
