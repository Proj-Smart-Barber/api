import { type Either, left, right } from "../../../../../core/logic/either";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import { Role } from "../../../../enterprise/entities/membership";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";

interface DeleteScheduleExceptionDTO {
  exceptionId: string;
  barbershopId: string;
  staffId: string;
}

type DeleteScheduleExceptionResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  null
>;

export class DeleteScheduleExceptionUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async execute({
    exceptionId,
    barbershopId,
    staffId,
  }: DeleteScheduleExceptionDTO): Promise<DeleteScheduleExceptionResponse> {
    const action = async (
      tx?: unknown,
    ): Promise<DeleteScheduleExceptionResponse> => {
      const exception = await this.scheduleExceptionsRepository.findById(
        exceptionId,
        tx,
      );

      if (!exception) {
        return left(new ResourceNotFoundError());
      }

      if (exception.barbershopId.toString() !== barbershopId) {
        return left(new NotAllowedError());
      }

      const barbershop = await this.barbershopsRepository.findById(
        barbershopId,
        tx,
      );
      if (!barbershop) {
        return left(new ResourceNotFoundError());
      }

      if (this.membershipsRepository) {
        const actorMembership =
          await this.membershipsRepository.findByBarbershopAndUser(
            barbershopId,
            staffId,
            tx,
          );

        const isOwnerActive =
          actorMembership &&
          actorMembership.role === Role.OWNER &&
          actorMembership.state === "ACTIVE";

        const isLegacyOwner = barbershop.ownerId.toString() === staffId;

        if (!isOwnerActive && !isLegacyOwner) {
          return left(new NotAllowedError());
        }
      } else if (barbershop.ownerId.toString() !== staffId) {
        return left(new NotAllowedError());
      }

      await this.scheduleExceptionsRepository.delete(exception, tx);

      return right(null);
    };

    if (this.unitOfWork) {
      return this.unitOfWork.withLocks({ unitIds: [barbershopId] }, action);
    }

    return action();
  }
}
