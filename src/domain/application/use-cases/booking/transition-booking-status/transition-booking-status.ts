import { type Either, left, right } from "../../../../../core/logic/either";
import { generateUuidV7 } from "../../../../../core/security/uuidv7";
import type { Booking } from "../../../../enterprise/entities/booking";
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
import type { TransitionBookingStatusDTO } from "./transition-booking-status-dto";

export interface TransitionBookingStatusSuccess {
  booking: Booking;
  serverTime: string;
}

export type TransitionBookingStatusUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | TerminalBookingStateError
  | BookingVersionConflictError
  | ActionDeadlinePassedError
  | Error,
  TransitionBookingStatusSuccess
>;

export class TransitionBookingStatusUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private membershipsRepository?: MembershipsRepository,
    private notificationsRepository?: NotificationsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute(
    dto: TransitionBookingStatusDTO,
  ): Promise<TransitionBookingStatusUseCaseResponse> {
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
          `Não é possível alterar o status de uma reserva em estado terminal: ${booking.status}.`,
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

    const actorId = dto.actorId;

    if (this.membershipsRepository) {
      const membership =
        await this.membershipsRepository.findByBarbershopAndUser(
          booking.barbershopId.toString(),
          actorId,
        );

      if (!membership || membership.state !== "ACTIVE") {
        return left(
          new NotAllowedError(
            "Apenas a equipe autorizada da unidade pode registrar atendimento.",
          ),
        );
      }

      if (
        membership.role === "BARBERMAN" &&
        booking.barbermanId.toString() !== actorId
      ) {
        return left(
          new NotAllowedError(
            "Barbeiro só pode registrar atendimento em agendamentos da própria agenda.",
          ),
        );
      }
    } else if (booking.barbermanId.toString() !== actorId) {
      return left(
        new NotAllowedError(
          "Apenas o barbeiro responsável pode registrar atendimento.",
        ),
      );
    }

    const runTransition = async (
      tx?: any,
      context?: { serverTime: Date },
    ): Promise<TransitionBookingStatusUseCaseResponse> => {
      const now = context?.serverTime ?? new Date();
      const startsAt =
        booking.startsAt ??
        new Date(
          `${booking.date.toISOString().split("T")[0]}T${booking.startTime}:00.000Z`,
        );

      if (dto.status === "COMPLETED") {
        const { allowed, reasonCode } = BookingPolicy.canComplete({
          status: booking.status,
          startsAt,
          serverTime: now,
          barbermanId: booking.barbermanId.toString(),
        });
        if (!allowed) {
          return left(
            new ActionDeadlinePassedError(
              `Agendamento só pode ser concluído após o horário de início (${reasonCode ?? "START_TIME_NOT_REACHED"}).`,
            ),
          );
        }
      } else if (dto.status === "NO_SHOW") {
        const { allowed, reasonCode } = BookingPolicy.canMarkNoShow({
          status: booking.status,
          startsAt,
          serverTime: now,
          barbermanId: booking.barbermanId.toString(),
        });
        if (!allowed) {
          return left(
            new ActionDeadlinePassedError(
              `Não comparecimento só pode ser registrado após 15 minutos do horário de início (${reasonCode ?? "GRACE_PERIOD_NOT_ELAPSED"}).`,
            ),
          );
        }
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

      if (
        booking.status === "CANCELLED" ||
        booking.status === "COMPLETED" ||
        booking.status === "NO_SHOW"
      ) {
        return left(
          new TerminalBookingStateError(
            `Reserva já atingiu estado terminal: ${booking.status}.`,
          ),
        );
      }

      const previousVersion = booking.version;
      const newVersion = previousVersion + 1;
      const previousStatus = booking.status ?? "CONFIRMED";

      booking.transitionStatus(dto.status, newVersion);

      await this.bookingsRepository.save(booking, tx, {
        event: {
          actorId,
          eventType: dto.status,
          previousVersion,
          newVersion,
          previousStatus,
          newStatus: dto.status,
          reason: dto.reason ?? `Status alterado para ${dto.status}`,
          metadata: {
            transitionedAt: now.toISOString(),
          },
        },
      });

      if (this.notificationsRepository && booking.customerId) {
        const customerIdStr = booking.customerId.toString();
        if (customerIdStr !== actorId) {
          const title =
            dto.status === "COMPLETED"
              ? "Atendimento Concluído"
              : "Não Comparecimento Registrado";
          const message =
            dto.status === "COMPLETED"
              ? "Seu atendimento foi concluído. Obrigado por utilizar nossos serviços!"
              : "Foi registrado o não comparecimento no seu agendamento.";

          await this.notificationsRepository.createManyWithTx(
            [
              {
                userId: customerIdStr,
                eventId: generateUuidV7(),
                type: `BOOKING_${dto.status}`,
                title,
                message,
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
      return await runTransition(dto.tx, {
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
        runTransition,
      );
    }

    return await runTransition();
  }
}
