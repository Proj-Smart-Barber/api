import { type Either, right } from "@/core/logic/either";
import type { ScheduleExceptionsRepository } from "../../repositories/schedule-exceptions-repository";
import { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

interface CreateScheduleExceptionDTO {
  barbershopId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  barbermanId?: string | null;
}

type CreateScheduleExceptionResponse = Either<
  Error,
  { exception: ScheduleException }
>;

export class CreateScheduleExceptionUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
  ) {}

  async execute({
    barbershopId,
    date,
    startTime,
    endTime,
    reason,
    barbermanId,
  }: CreateScheduleExceptionDTO): Promise<CreateScheduleExceptionResponse> {
    const exception = ScheduleException.create({
      barbershopId: new UniqueEntityId(barbershopId),
      date: new Date(date),
      startTime,
      endTime,
      reason,
      barbermanId: barbermanId ? new UniqueEntityId(barbermanId) : null,
    });

    await this.scheduleExceptionsRepository.create(exception);

    return right({ exception });
  }
}
