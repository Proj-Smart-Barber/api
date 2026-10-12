import { type Either, left, right } from "../../../../../core/logic/either";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { ScheduleException } from "../../../../enterprise/entities/schedule-exception";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";

interface CreateScheduleExceptionDTO {
  barbershopId: string;
  staffId: string;
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
    private barbershopsRepository: BarbershopsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute({
    barbershopId,
    staffId,
    date,
    startTime,
    endTime,
    reason,
    barbermanId,
  }: CreateScheduleExceptionDTO): Promise<CreateScheduleExceptionResponse> {
    const action = async (): Promise<CreateScheduleExceptionResponse> => {
      const barbershop =
        await this.barbershopsRepository.findById(barbershopId);

      if (!barbershop) {
        return left(new ResourceNotFoundError());
      }

      if (barbershop.ownerId.toString() !== staffId) {
        return left(new NotAllowedError());
      }

      if ((startTime && !endTime) || (!startTime && endTime)) {
        return left(
          new Error("Você deve fornecer ambos startTime e endTime, ou nenhum."),
        );
      }

      if (startTime && endTime && startTime >= endTime) {
        return left(
          new Error("O horário de fim deve ser maior que o horário de início."),
        );
      }

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
    };

    if (this.unitOfWork) {
      return this.unitOfWork.withLocks({ unitIds: [barbershopId] }, action);
    }

    return action();
  }
}
