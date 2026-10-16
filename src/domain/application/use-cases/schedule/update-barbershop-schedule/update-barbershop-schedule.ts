import { type Either, left, right } from "../../../../../core/logic/either";
import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import {
  ScheduleBookingConflictError,
  type ConflictingBooking,
} from "../../_errors/schedule-booking-conflict-error";
import { Role } from "../../../../enterprise/entities/membership";

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
  | ResourceNotFoundError
  | NotAllowedError
  | ScheduleBookingConflictError
  | Error,
  { schedules: BarbershopSchedule[] }
>;

export function getBookingStartUtc(
  dateStr: string,
  startTime: string,
  timeZone: string,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);
  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute);

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    let currentUtcMs = targetUtcMs;
    for (let i = 0; i < 4; i++) {
      const parts = formatter.formatToParts(new Date(currentUtcMs));
      let y = 0;
      let m = 0;
      let d = 0;
      let h = 0;
      let min = 0;
      for (const p of parts) {
        if (p.type === "year") y = Number(p.value);
        else if (p.type === "month") m = Number(p.value);
        else if (p.type === "day") d = Number(p.value);
        else if (p.type === "hour") h = Number(p.value);
        else if (p.type === "minute") min = Number(p.value);
      }
      const zonedMs = Date.UTC(y, m - 1, d, h, min);
      const diff = targetUtcMs - zonedMs;
      if (diff === 0) {
        return new Date(currentUtcMs);
      }
      currentUtcMs += diff;
    }
    return new Date(currentUtcMs);
  } catch (_e) {
    return new Date(targetUtcMs);
  }
}

export class UpdateBarbershopScheduleUseCase {
  constructor(
    private schedulesRepository: SchedulesRepository,
    private barbershopsRepository: BarbershopsRepository,
    private bookingsRepository: BookingsRepository,
  ) {}

  async execute({
    barbershopId,
    barbermanId,
    createdBy,
    schedules,
  }: UpdateBarbershopScheduleDTO): Promise<UpdateBarbershopScheduleResponse> {
    return await this.schedulesRepository.runWithLock(
      barbershopId,
      async () => {
        const barbershop =
          await this.barbershopsRepository.findById(barbershopId);

        if (!barbershop) {
          return left(new ResourceNotFoundError());
        }

        const isOwner = barbershop.ownerId.toString() === createdBy;

        if (!barbermanId) {
          if (!isOwner) {
            return left(new NotAllowedError());
          }
        } else {
          const isSelf = createdBy === barbermanId;
          if (!isSelf && !isOwner) {
            return left(new NotAllowedError());
          }

          const staffMemberships =
            await this.barbershopsRepository.findManyByStaffId(barbermanId);
          const hasEligibleMembership = staffMemberships.some(
            (m) =>
              m.barbershop.id.toString() === barbershopId &&
              (m.role === Role.BARBERMAN || m.role === Role.OWNER),
          );

          if (!hasEligibleMembership) {
            return left(new NotAllowedError());
          }
        }

        for (const item of schedules) {
          if (item.openTime >= item.closeTime) {
            return left(
              new Error(
                "O horário de fechamento deve ser maior que o de abertura.",
              ),
            );
          }
        }

        for (let i = 0; i < schedules.length; i++) {
          for (let j = i + 1; j < schedules.length; j++) {
            if (schedules[i].dayOfWeek === schedules[j].dayOfWeek) {
              const first = schedules[i];
              const second = schedules[j];
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

        if (barbermanId && schedules.length > 0) {
          const allBarbershopSchedules =
            await this.schedulesRepository.findManyByBarbershopId(barbershopId);
          const generalSchedules = allBarbershopSchedules.filter(
            (s) => !s.barbermanId,
          );

          for (const item of schedules) {
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

        const now = new Date();
        const timeZone = barbershop.timezone || "America/Sao_Paulo";

        // NOTA DE PROTEÇÃO BILATERAL CONTRA CONDIÇÃO DE CORRIDA:
        // A busca de agendamentos e o bulkReplace são executados atomicamente dentro
        // de runWithLock (que adquire pg_advisory_xact_lock por barbershopId).
        // Futuros use cases de criação de agendamento (CreateBookingUseCase) devem
        // obter o mesmo advisory lock no barbershopId durante sua transação para
        // fechar a proteção bilateral contra race conditions entre nova reserva e alteração de jornada.
        const futureBookings =
          await this.bookingsRepository.findManyFutureByBarbershop({
            barbershopId,
            barbermanId: barbermanId ?? undefined,
            from: now,
          });

        const conflictingBookings: ConflictingBooking[] = [];
        const daysMap = [
          "SUNDAY",
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
        ];

        for (const booking of futureBookings) {
          const bookingDateStr = booking.date.toISOString().split("T")[0];
          const bookingStartUtc = getBookingStartUtc(
            bookingDateStr,
            booking.startTime,
            timeZone,
          );

          if (bookingStartUtc.getTime() <= now.getTime()) {
            continue;
          }

          const [year, month, day] = bookingDateStr.split("-").map(Number);
          const dateAtNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          const bookingDayOfWeek = daysMap[dateAtNoon.getUTCDay()];

          const candidateShifts = schedules.filter(
            (s) => s.dayOfWeek === bookingDayOfWeek,
          );

          const fitsInSingleShift = candidateShifts.some(
            (shift) =>
              shift.openTime <= booking.startTime &&
              shift.closeTime >= booking.endTime,
          );

          if (!fitsInSingleShift) {
            conflictingBookings.push({
              bookingId: booking.id.toString(),
              date: bookingDateStr,
              startTime: booking.startTime,
              endTime: booking.endTime,
              barbermanId: booking.barbermanId.toString(),
            });
          }
        }

        if (conflictingBookings.length > 0) {
          return left(new ScheduleBookingConflictError(conflictingBookings));
        }

        const barbershopSchedules: BarbershopSchedule[] = [];

        for (const item of schedules) {
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
      },
    );
  }
}
