import { type Either, left, right } from "../../../../../core/logic/either";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import { Role } from "../../../../enterprise/entities/membership";
import { ScheduleException } from "../../../../enterprise/entities/schedule-exception";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import {
  ScheduleBookingConflictError,
  type ConflictingBooking,
} from "../../_errors/schedule-booking-conflict-error";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { getBookingLocalInterval } from "../update-barbershop-schedule/update-barbershop-schedule";

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
    private membershipsRepository?: MembershipsRepository,
    private bookingsRepository?: BookingsRepository,
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
    const action = async (
      tx?: unknown,
    ): Promise<CreateScheduleExceptionResponse> => {
      const barbershop = await this.barbershopsRepository.findById(
        barbershopId,
        tx,
      );

      if (!barbershop) {
        return left(new ResourceNotFoundError("Barbearia não encontrada."));
      }

      let effectiveBarbermanId: string | null = null;

      if (this.membershipsRepository) {
        const actorMembership =
          await this.membershipsRepository.findByBarbershopAndUser(
            barbershopId,
            staffId,
            tx,
          );

        if (actorMembership && actorMembership.state === "INACTIVE") {
          return left(
            new NotAllowedError("Usuário com vínculo inativo nesta unidade."),
          );
        }

        const isOwnerActive =
          actorMembership &&
          actorMembership.role === Role.OWNER &&
          actorMembership.state === "ACTIVE";

        const isLegacyOwner =
          actorMembership === null &&
          barbershop.ownerId.toString() === staffId;

        const isOwner = Boolean(isOwnerActive || isLegacyOwner);

        const isBarberActive =
          actorMembership &&
          actorMembership.role === Role.BARBERMAN &&
          actorMembership.state === "ACTIVE";

        if (isBarberActive) {
          if (barbermanId && barbermanId !== staffId) {
            return left(
              new NotAllowedError(
                "Profissional só pode gerenciar suas próprias exceções de agenda.",
              ),
            );
          }
          // Omitir barbermanId pelo barbeiro não gera exceção global: escopo é sempre o próprio usuário
          effectiveBarbermanId = staffId;
        } else if (isOwner) {
          effectiveBarbermanId = barbermanId ?? null;
          if (effectiveBarbermanId) {
            const targetMembership =
              await this.membershipsRepository.findByBarbershopAndUser(
                barbershopId,
                effectiveBarbermanId,
                tx,
              );

            if (!targetMembership || targetMembership.state !== "ACTIVE") {
              return left(
                new ResourceNotFoundError(
                  "Profissional não possui vínculo ativo nesta unidade.",
                ),
              );
            }
          }
        } else {
          return left(
            new NotAllowedError(
              "Usuário não possui permissão para gerenciar exceções nesta unidade.",
            ),
          );
        }
      } else {
        const isOwner = barbershop.ownerId.toString() === staffId;
        const isSelfBarber = Boolean(barbermanId && barbermanId === staffId);

        if (!isOwner && !isSelfBarber) {
          return left(new NotAllowedError());
        }

        effectiveBarbermanId = isOwner ? (barbermanId ?? null) : staffId;
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

      // Validação de conflitos com agendamentos existentes
      if (this.bookingsRepository) {
        const futureBookings =
          await this.bookingsRepository.findActiveAndFutureBookings({
            barbershopId,
            barbermanId: effectiveBarbermanId ?? undefined,
            tx,
          });

        const timeZone = barbershop.timezone || "America/Sao_Paulo";
        const dateStr = new Date(date).toISOString().split("T")[0];
        const conflictingBookings: ConflictingBooking[] = [];

        for (const booking of futureBookings) {
          if (booking.status === "CANCELLED") continue;
          const local = getBookingLocalInterval(booking, timeZone);
          if (local.dateStr !== dateStr) continue;

          if (!startTime && !endTime) {
            conflictingBookings.push({
              bookingId: booking.id.toString(),
              date: local.dateStr,
              startTime: local.startTime,
              endTime: local.endTime,
              barbermanId: booking.barbermanId.toString(),
            });
            continue;
          }

          if (startTime && endTime) {
            if (local.startTime < endTime && local.endTime > startTime) {
              conflictingBookings.push({
                bookingId: booking.id.toString(),
                date: local.dateStr,
                startTime: local.startTime,
                endTime: local.endTime,
                barbermanId: booking.barbermanId.toString(),
              });
            }
          }
        }

        if (conflictingBookings.length > 0) {
          return left(new ScheduleBookingConflictError(conflictingBookings));
        }
      }

      const exception = ScheduleException.create({
        barbershopId: new UniqueEntityId(barbershopId),
        date: new Date(date),
        startTime,
        endTime,
        reason,
        barbermanId: effectiveBarbermanId
          ? new UniqueEntityId(effectiveBarbermanId)
          : null,
      });

      await this.scheduleExceptionsRepository.create(exception, tx);

      return right({ exception });
    };

    if (this.unitOfWork) {
      return this.unitOfWork.withLocks({ unitIds: [barbershopId] }, action);
    }

    return action();
  }
}
