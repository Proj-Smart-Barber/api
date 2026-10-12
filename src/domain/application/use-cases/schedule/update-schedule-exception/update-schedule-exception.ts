import { type Either, left, right } from "../../../../../core/logic/either";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ScheduleException } from "../../../../enterprise/entities/schedule-exception";

import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";

interface UpdateScheduleExceptionDTO {
  exceptionId: string;
  barbershopId: string;
  staffId: string;
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
    private barbershopsRepository: BarbershopsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute({
    exceptionId,
    barbershopId,
    staffId,
    date,
    startTime,
    endTime,
    reason,
  }: UpdateScheduleExceptionDTO): Promise<UpdateScheduleExceptionResponse> {
    const action = async (): Promise<UpdateScheduleExceptionResponse> => {
      const exception =
        await this.scheduleExceptionsRepository.findById(exceptionId);

      if (!exception) {
        return left(new ResourceNotFoundError());
      }

      if (exception.barbershopId.toString() !== barbershopId) {
        return left(new NotAllowedError());
      }

      const barbershop =
        await this.barbershopsRepository.findById(barbershopId);
      if (!barbershop || barbershop.ownerId.toString() !== staffId) {
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

      const start = exception.startTime ?? null;
      const end = exception.endTime ?? null;

      if (
        (start === null && end !== null) ||
        (start !== null && end === null)
      ) {
        return left(
          new Error(
            "O horário de início e fim devem ser ambos nulos ou ambos preenchidos.",
          ),
        );
      }

      if (start !== null && end !== null) {
        if (end <= start) {
          return left(
            new Error(
              "O horário de fechamento deve ser maior que o de abertura.",
            ),
          );
        }
      }

      await this.scheduleExceptionsRepository.save(exception);

      return right({
        scheduleException: exception,
      });
    };

    if (this.unitOfWork) {
      return this.unitOfWork.withLocks({ unitIds: [barbershopId] }, action);
    }

    return action();
  }
}
