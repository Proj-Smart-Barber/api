import { type Either, left, right } from "../../../../../core/logic/either";
import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { Role } from "../../../../enterprise/entities/membership";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";

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
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async execute({
    barbershopId,
    barbermanId,
    createdBy,
    schedules,
  }: UpdateBarbershopScheduleDTO): Promise<UpdateBarbershopScheduleResponse> {
    const action = async (): Promise<UpdateBarbershopScheduleResponse> => {
      const barbershop =
        await this.barbershopsRepository.findById(barbershopId);

      if (!barbershop) {
        return left(new ResourceNotFoundError("Barbearia não encontrada."));
      }

      // Validação de autorização do autor (OWNER ativo na unidade)
      if (this.membershipsRepository) {
        const actorMembership =
          await this.membershipsRepository.findByBarbershopAndUser(
            barbershopId,
            createdBy,
          );

        const isOwnerActive =
          actorMembership &&
          actorMembership.role === Role.OWNER &&
          actorMembership.state === "ACTIVE";

        const isLegacyOwner = barbershop.ownerId.toString() === createdBy;

        if (!isOwnerActive && !isLegacyOwner) {
          return left(
            new NotAllowedError(
              "Apenas o proprietário ativo da unidade pode alterar jornadas de atendimento.",
            ),
          );
        }
      } else if (barbershop.ownerId.toString() !== createdBy) {
        return left(new NotAllowedError());
      }

      // Validação estrita do profissional alvo se barbermanId for fornecido
      if (barbermanId && this.membershipsRepository) {
        const targetMembership =
          await this.membershipsRepository.findByBarbershopAndUser(
            barbershopId,
            barbermanId,
          );

        if (!targetMembership || targetMembership.state !== "ACTIVE") {
          return left(
            new ResourceNotFoundError(
              "Profissional não possui vínculo ativo nesta unidade.",
            ),
          );
        }
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
    };

    if (this.unitOfWork) {
      return this.unitOfWork.withLocks({ unitIds: [barbershopId] }, action);
    }

    return action();
  }
}
