import { createHash } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import {
  BarbershopScheduleScope,
  type ScheduleScopeState,
} from "../../../../enterprise/entities/barbershop-schedule-scope";
import type { Booking } from "../../../../enterprise/entities/booking";
import { Role } from "../../../../enterprise/entities/membership";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import {
  ScheduleBookingConflictError,
  type ConflictingBooking,
} from "../../_errors/schedule-booking-conflict-error";
import { ScheduleVersionConflictError } from "../../_errors/schedule-version-conflict-error";
import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../services/operation-attempt-service";
import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";

export interface UpdateBarbershopScheduleDTO {
  barbershopId: string;
  barbermanId: string | null;
  createdBy: string;
  schedules: Array<{
    dayOfWeek: string;
    openTime: string;
    closeTime: string;
  }>;
  state?: ScheduleScopeState;
  expectedVersion?: number;
  requestId?: string;
  payloadHash?: string;
}

export interface UpdateBarbershopScheduleSuccess {
  schedules: BarbershopSchedule[];
  effectiveSchedules: BarbershopSchedule[];
  state: ScheduleScopeState;
  version: number;
  serverTime: string;
}

export type UpdateBarbershopScheduleResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | ScheduleBookingConflictError
  | ScheduleVersionConflictError
  | IdempotencyKeyError
  | Error,
  UpdateBarbershopScheduleSuccess
>;

export function computeSchedulePayloadHash(params: {
  barbershopId: string;
  barbermanId?: string | null;
  state?: string;
  expectedVersion?: number;
  schedules: Array<{ dayOfWeek: string; openTime: string; closeTime: string }>;
}): string {
  const sortedSchedules = [...params.schedules].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek)
      return a.dayOfWeek.localeCompare(b.dayOfWeek);
    if (a.openTime !== b.openTime) return a.openTime.localeCompare(b.openTime);
    return a.closeTime.localeCompare(b.closeTime);
  });

  const payload = {
    barbershopId: params.barbershopId,
    barbermanId: params.barbermanId ?? null,
    state: params.state ?? null,
    expectedVersion: params.expectedVersion ?? null,
    schedules: sortedSchedules,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const DAYS_MAP = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

function getBookingLocalInterval(
  booking: Booking,
  timeZone: string,
): { dayOfWeek: string; dateStr: string; startTime: string; endTime: string } {
  if (booking.startsAt) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    const startParts = formatter.formatToParts(booking.startsAt);
    let startHour = "00";
    let startMin = "00";
    let weekday = "Monday";
    let year = "2026";
    let month = "01";
    let day = "01";
    for (const p of startParts) {
      if (p.type === "weekday") weekday = p.value;
      if (p.type === "hour") startHour = p.value.padStart(2, "0");
      if (p.type === "minute") startMin = p.value.padStart(2, "0");
      if (p.type === "year") year = p.value;
      if (p.type === "month") month = p.value.padStart(2, "0");
      if (p.type === "day") day = p.value.padStart(2, "0");
    }

    const dayOfWeek = weekday.toUpperCase();
    const startTime = `${startHour}:${startMin}`;
    const dateStr = `${year}-${month}-${day}`;

    let endTime = booking.endTime;
    if (booking.endsAt) {
      const endParts = formatter.formatToParts(booking.endsAt);
      let endHour = "00";
      let endMin = "00";
      for (const p of endParts) {
        if (p.type === "hour") endHour = p.value.padStart(2, "0");
        if (p.type === "minute") endMin = p.value.padStart(2, "0");
      }
      endTime = `${endHour}:${endMin}`;
    } else if (!endTime) {
      const endMs = booking.startsAt.getTime() + 30 * 60 * 1000;
      const endParts = formatter.formatToParts(new Date(endMs));
      let endHour = "00";
      let endMin = "00";
      for (const p of endParts) {
        if (p.type === "hour") endHour = p.value.padStart(2, "0");
        if (p.type === "minute") endMin = p.value.padStart(2, "0");
      }
      endTime = `${endHour}:${endMin}`;
    }

    return { dayOfWeek, dateStr, startTime, endTime };
  }

  const dateStr = booking.date.toISOString().split("T")[0];
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateAtNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = DAYS_MAP[dateAtNoon.getUTCDay()];

  return {
    dayOfWeek,
    dateStr,
    startTime: booking.startTime,
    endTime: booking.endTime,
  };
}

export class UpdateBarbershopScheduleUseCase {
  constructor(
    private schedulesRepository: SchedulesRepository,
    private barbershopsRepository: BarbershopsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
    private membershipsRepository?: MembershipsRepository,
    private bookingsRepository?: BookingsRepository,
    private operationAttemptService?: OperationAttemptService,
  ) {}

  async execute(
    dto: UpdateBarbershopScheduleDTO,
  ): Promise<UpdateBarbershopScheduleResponse> {
    const payloadHash =
      dto.payloadHash ??
      computeSchedulePayloadHash({
        barbershopId: dto.barbershopId,
        barbermanId: dto.barbermanId,
        state: dto.state,
        expectedVersion: dto.expectedVersion,
        schedules: dto.schedules,
      });

    // Idempotência via OperationAttemptService quando requestId (UUIDv7) fornecido
    if (dto.requestId && this.operationAttemptService) {
      try {
        const attemptResult = await this.operationAttemptService.executeOnce(
          {
            actorId: dto.createdBy,
            operation: "UPDATE_SCHEDULE",
            requestId: dto.requestId,
            payloadHash,
            resourceKind: "SCHEDULE",
            lockResources: {
              unitIds: [dto.barbershopId],
              professionalIds: dto.barbermanId ? [dto.barbermanId] : undefined,
            },
          },
          async (tx, context) => {
            const updateResult = await this.performUpdate(
              dto,
              tx,
              context.serverTime,
            );
            if (updateResult.isLeft()) {
              throw updateResult.value;
            }

            const success = updateResult.value;
            return {
              resourceKind: "SCHEDULE",
              resourceId: dto.barbermanId
                ? `${dto.barbershopId}:${dto.barbermanId}`
                : dto.barbershopId,
              resourceVersion: success.version,
              data: {
                schedules: success.schedules.map((s) => ({
                  id: s.id.toString(),
                  barbershopId: s.barbershopId.toString(),
                  barbermanId: s.barbermanId?.toString() ?? null,
                  dayOfWeek: s.dayOfWeek,
                  openTime: s.openTime,
                  closeTime: s.closeTime,
                })),
                effectiveSchedules: success.effectiveSchedules.map((s) => ({
                  id: s.id.toString(),
                  barbershopId: s.barbershopId.toString(),
                  barbermanId: s.barbermanId?.toString() ?? null,
                  dayOfWeek: s.dayOfWeek,
                  openTime: s.openTime,
                  closeTime: s.closeTime,
                })),
                state: success.state,
                version: success.version,
                serverTime: success.serverTime,
              },
            };
          },
        );

        if (attemptResult.resource?.data) {
          const data = attemptResult.resource.data;
          const schedules = data.schedules.map((s: any) =>
            BarbershopSchedule.create(
              {
                barbershopId: new UniqueEntityId(s.barbershopId),
                barbermanId: s.barbermanId
                  ? new UniqueEntityId(s.barbermanId)
                  : null,
                dayOfWeek: s.dayOfWeek,
                openTime: s.openTime,
                closeTime: s.closeTime,
                createdBy: new UniqueEntityId(dto.createdBy),
              },
              new UniqueEntityId(s.id),
            ),
          );

          const effectiveSchedules = (data.effectiveSchedules || []).map(
            (s: any) =>
              BarbershopSchedule.create(
                {
                  barbershopId: new UniqueEntityId(s.barbershopId),
                  barbermanId: s.barbermanId
                    ? new UniqueEntityId(s.barbermanId)
                    : null,
                  dayOfWeek: s.dayOfWeek,
                  openTime: s.openTime,
                  closeTime: s.closeTime,
                  createdBy: new UniqueEntityId(dto.createdBy),
                },
                new UniqueEntityId(s.id),
              ),
          );

          return right({
            schedules,
            effectiveSchedules,
            state: data.state,
            version: data.version,
            serverTime: attemptResult.serverTime,
          });
        }
      } catch (err: any) {
        if (
          err instanceof ResourceNotFoundError ||
          err instanceof NotAllowedError ||
          err instanceof ScheduleBookingConflictError ||
          err instanceof ScheduleVersionConflictError ||
          err instanceof IdempotencyKeyError
        ) {
          return left(err);
        }
        return left(err instanceof Error ? err : new Error(String(err)));
      }
    }

    // Fluxo com locks transacionais quando sem idempotency key ou sem attemptService
    if (this.unitOfWork) {
      return this.unitOfWork.withLocks(
        {
          unitIds: [dto.barbershopId],
          professionalIds: dto.barbermanId ? [dto.barbermanId] : undefined,
        },
        async (tx, context) => this.performUpdate(dto, tx, context.serverTime),
      );
    }

    return this.performUpdate(dto, undefined, new Date());
  }

  private async performUpdate(
    dto: UpdateBarbershopScheduleDTO,
    tx: any,
    serverTime: Date,
  ): Promise<UpdateBarbershopScheduleResponse> {
    const barbershop = await this.barbershopsRepository.findById(
      dto.barbershopId,
    );
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    // 1. Autorização estrita baseada na sessão autenticada (createdBy)
    let isOwner = false;
    let isSelfBarber = false;

    if (this.membershipsRepository) {
      const actorMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          dto.barbershopId,
          dto.createdBy,
        );

      const isOwnerActive =
        actorMembership &&
        actorMembership.role === Role.OWNER &&
        actorMembership.state === "ACTIVE";

      const isLegacyOwner = barbershop.ownerId.toString() === dto.createdBy;
      isOwner = Boolean(isOwnerActive || isLegacyOwner);

      const isBarberActive =
        actorMembership &&
        actorMembership.role === Role.BARBERMAN &&
        actorMembership.state === "ACTIVE";

      if (isBarberActive && dto.barbermanId === dto.createdBy) {
        isSelfBarber = true;
      }

      if (!isOwner && !isSelfBarber) {
        if (
          isBarberActive &&
          (!dto.barbermanId || dto.barbermanId !== dto.createdBy)
        ) {
          return left(
            new NotAllowedError(
              "Profissional só pode gerenciar sua própria jornada de trabalho.",
            ),
          );
        }
        return left(
          new NotAllowedError(
            "Usuário não possui permissão para gerenciar jornadas nesta unidade.",
          ),
        );
      }

      // Se for OWNER gerenciando um profissional específico, validar vínculo ativo deste
      if (isOwner && dto.barbermanId) {
        const targetMembership =
          await this.membershipsRepository.findByBarbershopAndUser(
            dto.barbershopId,
            dto.barbermanId,
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
      isOwner = barbershop.ownerId.toString() === dto.createdBy;
      isSelfBarber = dto.barbermanId === dto.createdBy;

      if (!isOwner && !isSelfBarber) {
        return left(new NotAllowedError());
      }
    }

    // 2. Resolução de estado e validação de escopo
    let resolvedState: ScheduleScopeState = "CUSTOM";

    if (!dto.barbermanId) {
      // Jornada geral da unidade
      if (dto.state === "INHERIT") {
        return left(
          new Error(
            "A jornada geral da barbearia não pode herdar de outra jornada.",
          ),
        );
      }
      resolvedState = dto.schedules.length === 0 ? "CLOSED" : "CUSTOM";
    } else {
      // Jornada individual do profissional
      if (dto.state === "INHERIT") {
        resolvedState = "INHERIT";
        dto.schedules = [];
      } else if (dto.state === "CLOSED") {
        if (dto.schedules.length > 0) {
          return left(
            new Error(
              "Jornada com estado CLOSED não deve conter períodos de atendimento.",
            ),
          );
        }
        resolvedState = "CLOSED";
      } else if (dto.state === "CUSTOM") {
        if (dto.schedules.length === 0) {
          return left(
            new Error(
              "Jornada customizada exige pelo menos um período válido.",
            ),
          );
        }
        resolvedState = "CUSTOM";
      } else {
        // Sem state explícito (compatibilidade legada)
        if (isSelfBarber) {
          return left(
            new Error(
              "O estado da jornada (INHERIT, CUSTOM ou CLOSED) deve ser informado explicitamente.",
            ),
          );
        }
        resolvedState = dto.schedules.length === 0 ? "CLOSED" : "CUSTOM";
      }
    }

    // 3. Validação dos períodos de horário
    for (const item of dto.schedules) {
      if (item.openTime >= item.closeTime) {
        return left(
          new Error(
            "O horário de fechamento deve ser maior que o de abertura.",
          ),
        );
      }
    }

    for (let i = 0; i < dto.schedules.length; i++) {
      for (let j = i + 1; j < dto.schedules.length; j++) {
        if (dto.schedules[i].dayOfWeek === dto.schedules[j].dayOfWeek) {
          const first = dto.schedules[i];
          const second = dto.schedules[j];
          if (
            first.openTime < second.closeTime &&
            first.closeTime > second.openTime
          ) {
            return left(
              new Error("Horários sobrepostos no mesmo dia da semana."),
            );
          }
        }
      }
    }

    // Buscar horários gerais da unidade para validação de contenção e herança
    const allBarbershopSchedules =
      await this.schedulesRepository.findManyByBarbershopId(
        dto.barbershopId,
        tx,
      );
    const generalSchedules = allBarbershopSchedules.filter(
      (s) => !s.barbermanId,
    );

    if (
      dto.barbermanId &&
      resolvedState === "CUSTOM" &&
      dto.schedules.length > 0
    ) {
      for (const item of dto.schedules) {
        const matchingGeneralInterval = generalSchedules.find(
          (gen) =>
            gen.dayOfWeek === item.dayOfWeek &&
            item.openTime >= gen.openTime &&
            item.closeTime <= gen.closeTime,
        );

        if (!matchingGeneralInterval) {
          return left(
            new Error(
              "O período informado está fora do horário de funcionamento geral da barbearia.",
            ),
          );
        }
      }
    }

    // 4. Controle de versão otimista
    const currentScope = await this.schedulesRepository.findScope(
      dto.barbershopId,
      dto.barbermanId,
      tx,
    );
    const currentVersion = currentScope ? currentScope.version : 1;

    if (dto.expectedVersion !== undefined) {
      if (dto.expectedVersion !== currentVersion) {
        return left(new ScheduleVersionConflictError());
      }
    }

    // 5. Validação contra agendamentos futuros confirmados/em andamento
    if (this.bookingsRepository) {
      const futureBookings =
        await this.bookingsRepository.findActiveAndFutureBookings({
          barbershopId: dto.barbershopId,
          barbermanId: dto.barbermanId ?? undefined,
          now: serverTime,
          tx,
        });

      const timeZone = barbershop.timezone || "America/Sao_Paulo";
      const conflictingBookings: ConflictingBooking[] = [];

      // Definir os turnos candidatos efetivos decorrentes da alteração
      let candidateShifts: Array<{
        dayOfWeek: string;
        openTime: string;
        closeTime: string;
      }> = [];

      if (resolvedState === "CLOSED") {
        candidateShifts = [];
      } else if (resolvedState === "INHERIT") {
        candidateShifts = generalSchedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          openTime: s.openTime,
          closeTime: s.closeTime,
        }));
      } else {
        candidateShifts = dto.schedules;
      }

      for (const booking of futureBookings) {
        const local = getBookingLocalInterval(booking, timeZone);
        const dayShifts = candidateShifts.filter(
          (s) => s.dayOfWeek === local.dayOfWeek,
        );

        const fits = dayShifts.some(
          (shift) =>
            shift.openTime <= local.startTime &&
            shift.closeTime >= local.endTime,
        );

        if (!fits) {
          conflictingBookings.push({
            bookingId: booking.id.toString(),
            date: local.dateStr,
            startTime: local.startTime,
            endTime: local.endTime,
            barbermanId: booking.barbermanId.toString(),
          });
        }
      }

      if (conflictingBookings.length > 0) {
        return left(new ScheduleBookingConflictError(conflictingBookings));
      }
    }

    // 6. Gravação atômica da jornada e do escopo
    const barbershopSchedules: BarbershopSchedule[] = dto.schedules.map(
      (item) =>
        BarbershopSchedule.create({
          barbershopId: new UniqueEntityId(dto.barbershopId),
          createdBy: new UniqueEntityId(dto.createdBy),
          dayOfWeek: item.dayOfWeek,
          openTime: item.openTime,
          closeTime: item.closeTime,
          barbermanId: dto.barbermanId
            ? new UniqueEntityId(dto.barbermanId)
            : null,
        }),
    );

    await this.schedulesRepository.bulkReplace(
      dto.barbershopId,
      dto.barbermanId,
      barbershopSchedules,
      tx,
    );

    let nextVersion = currentVersion + 1;
    if (currentScope) {
      currentScope.state = resolvedState;
      currentScope.incrementVersion();
      currentScope.lastMutationId = dto.requestId ?? null;
      currentScope.lastMutationHash = dto.payloadHash ?? null;
      await this.schedulesRepository.saveScope(currentScope, tx);
      nextVersion = currentScope.version;
    } else {
      const newScope = BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId(dto.barbershopId),
        barbermanId: dto.barbermanId
          ? new UniqueEntityId(dto.barbermanId)
          : null,
        state: resolvedState,
        version: nextVersion,
        lastMutationId: dto.requestId ?? null,
        lastMutationHash: dto.payloadHash ?? null,
      });
      await this.schedulesRepository.saveScope(newScope, tx);
    }

    let effectiveSchedules: BarbershopSchedule[] = [];
    if (resolvedState === "INHERIT") {
      effectiveSchedules = generalSchedules;
    } else if (resolvedState === "CLOSED") {
      effectiveSchedules = [];
    } else {
      effectiveSchedules = barbershopSchedules;
    }

    return right({
      schedules: barbershopSchedules,
      effectiveSchedules,
      state: resolvedState,
      version: nextVersion,
      serverTime: serverTime.toISOString(),
    });
  }
}
