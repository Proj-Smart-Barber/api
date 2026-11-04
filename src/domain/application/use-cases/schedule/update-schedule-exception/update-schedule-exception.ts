import { type Either, left, right } from "../../../../../core/logic/either";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import {
  ScheduleBookingConflictError,
  type ConflictingBooking,
} from "../../_errors/schedule-booking-conflict-error";
import type { ScheduleException } from "../../../../enterprise/entities/schedule-exception";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { Role } from "../../../../enterprise/entities/membership";
import { getBookingLocalInterval } from "../update-barbershop-schedule/update-barbershop-schedule";

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
  ResourceNotFoundError | NotAllowedError | ScheduleBookingConflictError | Error,
  {
    scheduleException: ScheduleException;
  }
>;

export class UpdateScheduleExceptionUseCase {
  constructor(
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
    private membershipsRepository?: MembershipsRepository,
    private bookingsRepository?: BookingsRepository,
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
    const action = async (
      tx?: unknown,
    ): Promise<UpdateScheduleExceptionResponse> => {
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
        return left(new ResourceNotFoundError("Barbearia não encontrada."));
      }

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
          // Barbeiro só pode alterar exceções cujo escopo persistido seja o seu próprio ID
          if (exception.barbermanId?.toString() !== staffId) {
            return left(
              new NotAllowedError(
                "Profissional só pode gerenciar suas próprias exceções de agenda.",
              ),
            );
          }
        } else if (!isOwner) {
          return left(
            new NotAllowedError(
              "Usuário não possui permissão para gerenciar exceções nesta unidade.",
            ),
          );
        }
      } else {
        const isOwner = barbershop.ownerId.toString() === staffId;
        const isSelfBarber = Boolean(
          exception.barbermanId && exception.barbermanId.toString() === staffId,
        );
        if (!isOwner && !isSelfBarber) {
          return left(new NotAllowedError());
        }
      }

      const candidateDate = date !== undefined ? new Date(date) : exception.date;
      const candidateStartTime = startTime !== undefined ? startTime : exception.startTime;
      const candidateEndTime = endTime !== undefined ? endTime : exception.endTime;

      const start = candidateStartTime ?? null;
      const end = candidateEndTime ?? null;

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

      if (this.bookingsRepository) {
        const effectiveDateStr = candidateDate.toISOString().split("T")[0];
        const futureBookings =
          await this.bookingsRepository.findActiveAndFutureBookings({
            barbershopId,
            barbermanId: exception.barbermanId?.toString() ?? undefined,
            tx,
          });

        const timeZone = barbershop.timezone || "America/Sao_Paulo";
        const conflictingBookings: ConflictingBooking[] = [];

        for (const booking of futureBookings) {
          if (booking.status === "CANCELLED") continue;
          const local = getBookingLocalInterval(booking, timeZone);
          if (local.dateStr !== effectiveDateStr) continue;

          if (!start && !end) {
            conflictingBookings.push({
              bookingId: booking.id.toString(),
              date: local.dateStr,
              startTime: local.startTime,
              endTime: local.endTime,
              barbermanId: booking.barbermanId.toString(),
            });
            continue;
          }

          if (start && end) {
            if (local.startTime < end && local.endTime > start) {
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

      exception.date = candidateDate;
      exception.startTime = candidateStartTime;
      exception.endTime = candidateEndTime;
      if (reason !== undefined) {
        exception.reason = reason;
      }

      await this.scheduleExceptionsRepository.save(exception, tx);

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
