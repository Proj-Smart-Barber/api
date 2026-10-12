import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import { generateUuidV7 } from "../../../../../core/security/uuidv7";
import type { Booking } from "../../../../enterprise/entities/booking";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";
import { BookingPolicy } from "../../../services/booking-policy";
import {
  ActionDeadlinePassedError,
  BookingVersionConflictError,
  QuoteChangedError,
  SlotUnavailableError,
  TerminalBookingStateError,
  type AuthoritativeQuote,
} from "../../_errors/booking-errors";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { RescheduleBookingDTO } from "./reschedule-booking-dto";

export interface RescheduleBookingSuccess {
  booking: Booking;
  serverTime: string;
}

export type RescheduleBookingUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | TerminalBookingStateError
  | BookingVersionConflictError
  | ActionDeadlinePassedError
  | SlotUnavailableError
  | QuoteChangedError
  | Error,
  RescheduleBookingSuccess
>;

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function getOffsetForTimezone(dateStr: string, timeZone: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(d);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tzPart) {
      const offset = tzPart.replace("GMT", "");
      if (offset === "") return "Z";
      if (offset === "+00:00") return "+00:00";
      return offset;
    }
  } catch (_e) {}
  return "-03:00";
}

export class RescheduleBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private servicesRepository: ServicesRepository,
    private membershipsRepository?: MembershipsRepository,
    private notificationsRepository?: NotificationsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute(
    dto: RescheduleBookingDTO,
  ): Promise<RescheduleBookingUseCaseResponse> {
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
          `Não é possível reagendar uma reserva em estado terminal: ${booking.status}.`,
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
            "Barbeiro só pode reagendar agendamentos da própria agenda.",
          ),
        );
      }

      if (
        membership.role === "BARBERMAN" &&
        dto.barbermanId &&
        dto.barbermanId !== actorId
      ) {
        return left(
          new NotAllowedError(
            "Barbeiro não pode transferir reserva para outro profissional.",
          ),
        );
      }

      scope = "UNIT";
    } else if (booking.barbermanId.toString() === actorId) {
      scope = "UNIT";
    } else {
      return left(
        new NotAllowedError("Usuário não autorizado a reagendar esta reserva."),
      );
    }

    const targetBarbermanId = dto.barbermanId ?? booking.barbermanId.toString();

    // Validar se profissional de destino pertence à unidade se alterado
    if (
      this.membershipsRepository &&
      targetBarbermanId !== booking.barbermanId.toString()
    ) {
      const targetMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          booking.barbershopId.toString(),
          targetBarbermanId,
        );
      if (!targetMembership || targetMembership.state !== "ACTIVE") {
        return left(
          new NotAllowedError(
            "Profissional selecionado não possui vínculo ativo nesta unidade.",
          ),
        );
      }
    }

    // Resolver serviços e quote
    let targetServiceIds: string[] = [];
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      targetServiceIds = Array.from(new Set(dto.serviceIds));
    } else {
      // Manter os serviços existentes
      const currentDetails = await this.bookingsRepository.findByIdWithDetails(
        booking.id.toString(),
      );
      if (currentDetails && currentDetails.services.length > 0) {
        targetServiceIds = currentDetails.services
          .map((s) => s.serviceId)
          .filter((id): id is string => Boolean(id));
      }
    }

    if (targetServiceIds.length === 0) {
      return left(new Error("Pelo menos um serviço é obrigatório."));
    }

    const resolvedServices =
      await this.servicesRepository.findManyByIds(targetServiceIds);

    if (resolvedServices.length !== targetServiceIds.length) {
      return left(
        new ResourceNotFoundError(
          "Um ou mais serviços selecionados não foram encontrados.",
        ),
      );
    }

    for (const service of resolvedServices) {
      if (service.barbershopId.toString() !== booking.barbershopId.toString()) {
        return left(
          new NotAllowedError(
            "Todos os serviços devem pertencer à mesma unidade da reserva.",
          ),
        );
      }
      if (service.isActive === false) {
        return left(
          new NotAllowedError(
            `Serviço '${service.title}' está inativo no momento.`,
          ),
        );
      }
    }

    const authoritativeTotalPriceInCents = resolvedServices.reduce(
      (sum, s) => sum + s.priceInCents,
      0,
    );
    const authoritativeTotalDurationInMinutes = resolvedServices.reduce(
      (sum, s) => sum + s.durationInMinutes,
      0,
    );

    const quote: AuthoritativeQuote = {
      serviceItems: resolvedServices.map((s) => ({
        serviceId: s.id.toString(),
        title: s.title,
        priceInCents: s.priceInCents,
        durationInMinutes: s.durationInMinutes,
        legacyAggregate: false,
      })),
      totalPriceInCents: authoritativeTotalPriceInCents,
      totalDurationInMinutes: authoritativeTotalDurationInMinutes,
    };

    if (
      dto.expectedTotalPriceInCents !== undefined &&
      dto.expectedTotalPriceInCents !== authoritativeTotalPriceInCents
    ) {
      return left(
        new QuoteChangedError(
          quote,
          new Date().toISOString(),
          undefined,
          "O preço total do agendamento foi alterado.",
        ),
      );
    }

    if (
      dto.expectedDurationInMinutes !== undefined &&
      dto.expectedDurationInMinutes !== authoritativeTotalDurationInMinutes
    ) {
      return left(
        new QuoteChangedError(
          quote,
          new Date().toISOString(),
          undefined,
          "A duração total do agendamento foi alterada.",
        ),
      );
    }

    const calculatedEndTime = addMinutesToTime(
      dto.startTime,
      authoritativeTotalDurationInMinutes,
    );

    const timezone = booking.timezone ?? "America/Sao_Paulo";
    const offset = getOffsetForTimezone(dto.date, timezone);
    const newStartsAt = new Date(`${dto.date}T${dto.startTime}:00${offset}`);
    const newEndsAt = new Date(`${dto.date}T${calculatedEndTime}:00${offset}`);

    const runReschedule = async (
      tx?: any,
      context?: { serverTime: Date },
    ): Promise<RescheduleBookingUseCaseResponse> => {
      const now = context?.serverTime ?? new Date();

      if (newStartsAt.getTime() <= now.getTime()) {
        return left(
          new SlotUnavailableError(
            "Não é possível agendar em horário passado.",
          ),
        );
      }

      const originalStartsAt =
        booking.startsAt ??
        new Date(
          `${booking.date.toISOString().split("T")[0]}T${booking.startTime}:00.000Z`,
        );

      const { allowed, reasonCode } = BookingPolicy.canReschedule({
        status: booking.status,
        startsAt: originalStartsAt,
        serverTime: now,
        scope,
        actorId,
        customerId: booking.customerId?.toString(),
        barbermanId: booking.barbermanId.toString(),
      });

      if (!allowed) {
        return left(
          new ActionDeadlinePassedError(
            `Prazo para reagendamento expirado (${reasonCode ?? "DEADLINE_PASSED"}).`,
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

      // Validar sobreposição do novo slot (excluindo a própria reserva)
      const overlapping = await this.bookingsRepository.findOverlapping({
        barbermanId: targetBarbermanId,
        barbershopId: booking.barbershopId.toString(),
        startAt: newStartsAt,
        endAt: newEndsAt,
        excludeBookingId: booking.id.toString(),
        tx,
      });

      if (overlapping) {
        return left(
          new SlotUnavailableError(
            "Horário indisponível para o profissional selecionado.",
          ),
        );
      }

      const previousVersion = booking.version;
      const newVersion = previousVersion + 1;
      const previousBarbermanId = booking.barbermanId.toString();

      const newSnapshots = resolvedServices.map((s) => ({
        serviceId: s.id.toString(),
        title: s.title,
        priceInCents: s.priceInCents,
        durationInMinutes: s.durationInMinutes,
        legacyAggregate: false,
      }));

      booking.reschedule({
        barbermanId: new UniqueEntityId(targetBarbermanId),
        date: new Date(`${dto.date}T00:00:00.000Z`),
        startTime: dto.startTime,
        endTime: calculatedEndTime,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        services: newSnapshots,
        totalPriceInCents: authoritativeTotalPriceInCents,
        totalDurationInMinutes: authoritativeTotalDurationInMinutes,
        newVersion,
      });

      await this.bookingsRepository.save(booking, tx, {
        updateItems: true,
        event: {
          actorId,
          eventType: "RESCHEDULED",
          previousVersion,
          newVersion,
          previousStatus: "CONFIRMED",
          newStatus: "CONFIRMED",
          reason: dto.reason ?? "Reagendamento solicitado",
          metadata: {
            scope,
            newStartsAt: newStartsAt.toISOString(),
            newEndsAt: newEndsAt.toISOString(),
            previousBarbermanId,
            targetBarbermanId,
          },
        },
      });

      if (this.notificationsRepository) {
        const recipients = new Set<string>();
        if (booking.customerId && booking.customerId.toString() !== actorId) {
          recipients.add(booking.customerId.toString());
        }
        if (targetBarbermanId !== actorId) {
          recipients.add(targetBarbermanId);
        }
        if (
          previousBarbermanId !== targetBarbermanId &&
          previousBarbermanId !== actorId
        ) {
          recipients.add(previousBarbermanId);
        }

        const items = Array.from(recipients).map((recipientId) => ({
          userId: recipientId,
          eventId: generateUuidV7(),
          type: "BOOKING_RESCHEDULED",
          title: "Agendamento Reagendado",
          message: `Agendamento alterado para ${dto.date} às ${dto.startTime}.`,
          referenceType: "BOOKING",
          referenceId: booking.id.toString(),
          scheduledAt: now,
          sentAt: now,
        }));

        if (items.length > 0) {
          await this.notificationsRepository.createManyWithTx(items, tx);
        }
      }

      return right({
        booking,
        serverTime: now.toISOString(),
      });
    };

    if (this.unitOfWork) {
      const professionalIds = Array.from(
        new Set([booking.barbermanId.toString(), targetBarbermanId]),
      );
      return await this.unitOfWork.withLocks(
        {
          unitIds: [booking.barbershopId.toString()],
          professionalIds,
          bookingIds: [booking.id.toString()],
        },
        runReschedule,
      );
    }

    return await runReschedule();
  }
}
