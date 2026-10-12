import { type Either, left, right } from "../../../../../core/logic/either";
import { generateUuidV7 } from "../../../../../core/security/uuidv7";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";
import { BookingPolicy } from "../../../services/booking-policy";
import {
  ActionDeadlinePassedError,
  BookingVersionConflictError,
  TerminalBookingStateError,
} from "../../_errors/booking-errors";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { UnauthorizedError } from "../../_errors/unauthorized-error";
import type { CancelBookingDTO } from "./cancel-booking-dto";
import type { CancelBookingResponse } from "./cancel-booking-response";

export type CancelBookingUseCaseResponse = Either<
  | ResourceNotFoundError
  | UnauthorizedError
  | NotAllowedError
  | TerminalBookingStateError
  | BookingVersionConflictError
  | ActionDeadlinePassedError
  | Error,
  CancelBookingResponse
>;

export class CancelBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private membershipsRepository?: MembershipsRepository,
    private notificationsRepository?: NotificationsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute(dto: CancelBookingDTO): Promise<CancelBookingUseCaseResponse> {
    const booking = await this.bookingsRepository.findById(dto.bookingId);

    if (!booking) {
      return left(new ResourceNotFoundError("Reserva não encontrada."));
    }

    if (
      booking.status === "CANCELLED" ||
      booking.status === "COMPLETED" ||
      booking.status === "NO_SHOW"
    ) {
      return left(
        new TerminalBookingStateError(
          `Não é possível cancelar uma reserva em estado terminal: ${booking.status}.`,
        ),
      );
    }

    if (
      dto.expectedVersion !== undefined &&
      booking.version !== dto.expectedVersion
    ) {
      return left(
        new BookingVersionConflictError(
          "Versão da reserva não coincide com a esperada.",
          booking.version,
        ),
      );
    }

    const actorId = dto.actorId ?? (dto as any).barbermanId;
    let scope: "PERSONAL" | "UNIT" = dto.scope ?? "PERSONAL";

    if (booking.customerId && booking.customerId.toString() === actorId) {
      scope = "PERSONAL";
    } else if (this.membershipsRepository) {
      const membership =
        await this.membershipsRepository.findByBarbershopAndUser(
          booking.barbershopId.toString(),
          actorId,
        );

      if (!membership || membership.state !== "ACTIVE") {
        return left(
          new NotAllowedError(
            "Usuário não possui vínculo ativo para gerenciar esta reserva.",
          ),
        );
      }

      if (
        membership.role === "BARBERMAN" &&
        booking.barbermanId.toString() !== actorId
      ) {
        return left(
          new NotAllowedError(
            "Barbeiro só pode cancelar agendamentos da própria agenda.",
          ),
        );
      }

      scope = "UNIT";
    } else if (booking.barbermanId.toString() === actorId) {
      scope = "UNIT";
    } else {
      return left(
        new NotAllowedError("Usuário não autorizado a cancelar esta reserva."),
      );
    }

    const runCancel = async (
      tx?: any,
      context?: { serverTime: Date },
    ): Promise<CancelBookingUseCaseResponse> => {
      const now = context?.serverTime ?? new Date();
      const startsAt =
        booking.startsAt ??
        new Date(
          `${booking.date.toISOString().split("T")[0]}T${booking.startTime}:00.000Z`,
        );

      const { allowed, reasonCode } = BookingPolicy.canCancel({
        status: booking.status,
        startsAt,
        serverTime: now,
        scope,
        actorId,
        customerId: booking.customerId?.toString(),
        barbermanId: booking.barbermanId.toString(),
      });

      if (!allowed) {
        return left(
          new ActionDeadlinePassedError(
            `Prazo para cancelamento expirado (${reasonCode ?? "DEADLINE_PASSED"}).`,
          ),
        );
      }

      if (
        dto.expectedVersion !== undefined &&
        booking.version !== dto.expectedVersion
      ) {
        return left(
          new BookingVersionConflictError(
            "Versão da reserva não coincide com a esperada.",
            booking.version,
          ),
        );
      }

      const previousVersion = booking.version;
      const newVersion = previousVersion + 1;
      booking.cancel(newVersion);

      await this.bookingsRepository.save(booking, tx, {
        event: {
          actorId,
          eventType: "CANCELLED",
          previousVersion,
          newVersion,
          previousStatus: "CONFIRMED",
          newStatus: "CANCELLED",
          reason: dto.reason ?? "Cancelado pelo usuário",
          metadata: {
            scope,
            cancelledAt: now.toISOString(),
          },
        },
      });

      if (this.notificationsRepository) {
        const recipientId =
          scope === "PERSONAL"
            ? booking.barbermanId.toString()
            : booking.customerId?.toString();

        if (recipientId && recipientId !== actorId) {
          await this.notificationsRepository.createManyWithTx(
            [
              {
                userId: recipientId,
                eventId: generateUuidV7(),
                type: "BOOKING_CANCELLED",
                title: "Agendamento Cancelado",
                message: `O agendamento das ${booking.startTime} foi cancelado.`,
                referenceType: "BOOKING",
                referenceId: booking.id.toString(),
                scheduledAt: now,
                sentAt: now,
              },
            ],
            tx,
          );
        }
      }

      return right({
        booking,
        serverTime: now.toISOString(),
      });
    };

    if (dto.tx) {
      return await runCancel(dto.tx, {
        serverTime: dto.serverTime ?? new Date(),
      });
    }

    if (this.unitOfWork) {
      return await this.unitOfWork.withLocks(
        {
          unitIds: [booking.barbershopId.toString()],
          professionalIds: [booking.barbermanId.toString()],
          bookingIds: [booking.id.toString()],
        },
        runCancel,
      );
    }

    return await runCancel();
  }
}
