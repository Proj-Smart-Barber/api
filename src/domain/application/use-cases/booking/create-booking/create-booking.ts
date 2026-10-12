import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Booking } from "../../../../enterprise/entities/booking";
import { BookingServiceItem } from "../../../../enterprise/entities/booking-service-item";
import type { Service } from "../../../../enterprise/entities/service";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";
import {
  SlotUnavailableError,
  QuoteChangedError,
  MembershipInactiveError,
  CustomerNotEligibleError,
  type AuthoritativeQuote,
} from "../../_errors/booking-errors";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { CreateBookingDTO } from "./create-booking-dto";

export interface CreateBookingUseCaseSuccess {
  booking: Booking;
  serverTime: string;
}

export type CreateBookingUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | SlotUnavailableError
  | QuoteChangedError
  | MembershipInactiveError
  | CustomerNotEligibleError
  | Error,
  CreateBookingUseCaseSuccess
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

export class CreateBookingUseCase {
  constructor(
    private bookingsRepository: BookingsRepository,
    private servicesRepository: ServicesRepository,
    private membershipsRepository?: MembershipsRepository,
    private usersRepository?: UsersRepository,
    private barbershopsRepository?: BarbershopsRepository,
    private notificationsRepository?: NotificationsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute(dto: CreateBookingDTO): Promise<CreateBookingUseCaseResponse> {
    const scope = dto.scope ?? "PERSONAL";
    const actorId = dto.actorId ?? dto.customerId;

    if (!actorId) {
      return left(new Error("Ator ou cliente não especificado."));
    }

    // 1. Determinação e validação de escopo e beneficiário
    let effectiveCustomerId = actorId;

    if (scope === "PERSONAL") {
      if (dto.customerId && dto.customerId !== actorId) {
        return left(
          new NotAllowedError(
            "No agendamento pessoal, o beneficiário deve ser o próprio usuário autenticado.",
          ),
        );
      }
      effectiveCustomerId = actorId;
    } else if (scope === "UNIT") {
      if (!dto.shopId || !dto.customerId) {
        return left(
          new Error("Agendamento operacional exige shopId e customerId."),
        );
      }

      if (this.membershipsRepository) {
        const actorMembership =
          await this.membershipsRepository.findByBarbershopAndUser(
            dto.shopId,
            actorId,
          );

        if (!actorMembership || actorMembership.state !== "ACTIVE") {
          return left(
            new MembershipInactiveError(
              "Ator não possui vínculo ativo nesta unidade.",
            ),
          );
        }

        if (
          actorMembership.role === "BARBERMAN" &&
          dto.barbermanId !== actorId
        ) {
          return left(
            new NotAllowedError(
              "Barbeiro só pode criar agendamento na sua própria agenda.",
            ),
          );
        }
      }

      effectiveCustomerId = dto.customerId;
    }

    // 2. Validação da elegibilidade do cliente beneficiário
    if (this.usersRepository) {
      const customerUser =
        await this.usersRepository.findById(effectiveCustomerId);
      if (!customerUser) {
        return left(
          new CustomerNotEligibleError("Cliente beneficiário não encontrado."),
        );
      }
      if (!customerUser.isEmailVerified) {
        return left(
          new CustomerNotEligibleError(
            "Cliente beneficiário deve possuir e-mail verificado para agendar.",
          ),
        );
      }
    }

    // 3. Validação dos serviços
    const rawIds =
      dto.serviceIds && dto.serviceIds.length > 0
        ? dto.serviceIds
        : dto.serviceId
          ? [dto.serviceId]
          : [];

    if (rawIds.length === 0) {
      return left(new ResourceNotFoundError("Nenhum serviço selecionado."));
    }

    const uniqueIds = Array.from(new Set(rawIds));
    if (uniqueIds.length !== rawIds.length) {
      return left(new Error("IDs de serviços duplicados no agendamento."));
    }

    const resolvedServices: Service[] = [];
    for (const id of uniqueIds) {
      const s = await this.servicesRepository.findById(id);
      if (!s || !s.isActive) {
        return left(
          new ResourceNotFoundError("Serviço não encontrado ou inativo."),
        );
      }
      resolvedServices.push(s);
    }

    const targetShopId = resolvedServices[0].barbershopId.toString();
    const hasDifferentShop = resolvedServices.some(
      (s) => s.barbershopId.toString() !== targetShopId,
    );
    if (hasDifferentShop) {
      return left(
        new Error("Todos os serviços devem pertencer à mesma barbearia."),
      );
    }

    if (dto.shopId && dto.shopId !== targetShopId) {
      return left(
        new Error("A unidade dos serviços difere da unidade solicitada."),
      );
    }

    // 4. Validação do vínculo ativo do barbeiro na unidade
    if (this.membershipsRepository) {
      const barberMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          targetShopId,
          dto.barbermanId,
        );

      if (!barberMembership || barberMembership.state !== "ACTIVE") {
        return left(
          new MembershipInactiveError(
            "O profissional não possui vínculo ativo nesta unidade.",
          ),
        );
      }
    }

    // 5. Se houver unitOfWork e não estivermos já em uma transação, encapsular com locks
    if (this.unitOfWork && !dto.tx) {
      return this.unitOfWork.withLocks(
        {
          unitIds: [targetShopId],
          professionalIds: [dto.barbermanId],
        },
        async (tx, context) => {
          return this.performCreation(
            {
              ...dto,
              tx,
              clockTime: context.serverTime,
            },
            targetShopId,
            effectiveCustomerId,
            resolvedServices,
          );
        },
      );
    }

    return this.performCreation(
      dto,
      targetShopId,
      effectiveCustomerId,
      resolvedServices,
    );
  }

  private async performCreation(
    dto: CreateBookingDTO & { clockTime?: Date },
    targetShopId: string,
    effectiveCustomerId: string,
    resolvedServices: any[],
  ): Promise<CreateBookingUseCaseResponse> {
    const serverTime = dto.clockTime ?? new Date();

    const calculatedTotalPriceInCents = resolvedServices.reduce(
      (acc, s) => acc + s.priceInCents,
      0,
    );
    const calculatedDurationInMinutes = resolvedServices.reduce(
      (acc, s) => acc + s.durationInMinutes,
      0,
    );

    // 6. Verificação autoritativa do orçamento
    if (
      (dto.expectedTotalPriceInCents !== undefined &&
        dto.expectedTotalPriceInCents !== calculatedTotalPriceInCents) ||
      (dto.expectedDurationInMinutes !== undefined &&
        dto.expectedDurationInMinutes !== calculatedDurationInMinutes)
    ) {
      const quote: AuthoritativeQuote = {
        serviceItems: resolvedServices.map((s) => ({
          serviceId: s.id.toString(),
          title: s.title,
          priceInCents: s.priceInCents,
          durationInMinutes: s.durationInMinutes,
          legacyAggregate: false,
        })),
        totalPriceInCents: calculatedTotalPriceInCents,
        totalDurationInMinutes: calculatedDurationInMinutes,
      };

      return left(
        new QuoteChangedError(
          quote,
          serverTime.toISOString(),
          dto.clientRequestId,
        ),
      );
    }

    const resolvedEndTime =
      dto.endTime ??
      addMinutesToTime(dto.startTime, calculatedDurationInMinutes);

    if (dto.startTime >= resolvedEndTime) {
      return left(
        new Error("O horário de fim deve ser maior que o horário de início."),
      );
    }

    let timezone = "America/Sao_Paulo";
    if (this.barbershopsRepository) {
      const shop = await this.barbershopsRepository.findById(targetShopId);
      if (shop?.timezone) timezone = shop.timezone;
    }
    const offset = getOffsetForTimezone(dto.date, timezone);

    const bookingDate = new Date(`${dto.date}T00:00:00.000Z`);
    const startAt = dto.slotStartAt
      ? new Date(dto.slotStartAt)
      : new Date(`${dto.date}T${dto.startTime}:00${offset}`);
    const endAt = new Date(
      startAt.getTime() + calculatedDurationInMinutes * 60 * 1000,
    );

    if (
      Number.isNaN(bookingDate.getTime()) ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime())
    ) {
      return left(new Error("Data ou horários inválidos."));
    }

    if (startAt.getTime() <= serverTime.getTime()) {
      return left(
        new SlotUnavailableError("Não é possível agendar em horário passado."),
      );
    }

    // 7. Verificação de sobreposição / conflito entre unidades
    const overlappingBooking = await this.bookingsRepository.findOverlapping({
      barbermanId: dto.barbermanId,
      barbershopId: targetShopId,
      startAt,
      endAt,
      tx: dto.tx,
    });

    if (overlappingBooking) {
      return left(new SlotUnavailableError());
    }

    // 8. Criação e persistência do agendamento com snapshots
    const booking = Booking.create({
      barbershopId: new UniqueEntityId(targetShopId),
      barbermanId: new UniqueEntityId(dto.barbermanId),
      customerId: new UniqueEntityId(effectiveCustomerId),
      createdByUserId: new UniqueEntityId(dto.actorId),
      startsAt: startAt,
      endsAt: endAt,
      timezone,
      status: "CONFIRMED",
      version: 1,
      totalPriceInCents: calculatedTotalPriceInCents,
      totalDurationInMinutes: calculatedDurationInMinutes,
      date: bookingDate,
      startTime: dto.startTime,
      endTime: resolvedEndTime,
      clientRequestId: dto.clientRequestId ?? null,
    });

    const items = resolvedServices.map((s) =>
      BookingServiceItem.create({
        bookingId: booking.id,
        serviceId: s.id,
        title: s.title,
        priceInCents: s.priceInCents,
        durationInMinutes: s.durationInMinutes,
        legacyAggregate: false,
      }),
    );

    await this.bookingsRepository.createWithItems({
      booking,
      items,
      tx: dto.tx,
    });

    // 9. Materialização das notificações no feed na mesma transação
    if (this.notificationsRepository) {
      const notificationsList = [
        {
          userId: effectiveCustomerId,
          eventId: booking.id.toString(),
          type: "BOOKING_CREATED",
          title: "Agendamento confirmado",
          message: `Seu agendamento para ${dto.date} às ${dto.startTime} foi confirmado.`,
          referenceType: "BOOKING",
          referenceId: booking.id.toString(),
          scheduledAt: serverTime,
          sentAt: serverTime,
        },
      ];

      // Se o cliente beneficiário for diferente do profissional, notifica o profissional também
      if (effectiveCustomerId !== dto.barbermanId) {
        notificationsList.push({
          userId: dto.barbermanId,
          eventId: booking.id.toString(),
          type: "BOOKING_CREATED",
          title: "Novo agendamento",
          message: `Novo atendimento agendado para ${dto.date} às ${dto.startTime}.`,
          referenceType: "BOOKING",
          referenceId: booking.id.toString(),
          scheduledAt: serverTime,
          sentAt: serverTime,
        });
      }

      await this.notificationsRepository.createManyWithTx(
        notificationsList,
        dto.tx,
      );
    }

    return right({
      booking,
      serverTime: serverTime.toISOString(),
    });
  }
}
