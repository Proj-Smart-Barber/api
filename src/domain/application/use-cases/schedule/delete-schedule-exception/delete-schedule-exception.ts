import { type Either, left, right } from "@/core/logic/either";
import type { ScheduleExceptionsRepository } from "@/domain/application/repositories/schedule-exceptions-repository";

interface DeleteScheduleExceptionDTO {
  exceptionId: string;
}

type DeleteScheduleExceptionResponse = Either<Error, null>;

export class DeleteScheduleExceptionUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
  ) {}

  async execute({
    exceptionId,
  }: DeleteScheduleExceptionDTO): Promise<DeleteScheduleExceptionResponse> {
    const exception =
      await this.scheduleExceptionsRepository.findById(exceptionId);

    if (!exception) {
      return left(new Error("Exceção não encontrada."));
    }

    await this.scheduleExceptionsRepository.delete(exception);

    return right(null);
  }
}
