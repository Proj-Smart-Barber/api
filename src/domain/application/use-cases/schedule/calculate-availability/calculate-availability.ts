import { type Either, left, right } from "../../../../../core/logic/either";
import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { EffectiveScheduleResolver } from "../../../services/effective-schedule-resolver";

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
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

interface CalculateAvailabilityDTO {
  barbershopId: string;
  date: string;
  serviceIds: string[];
  barbermanId?: string | null;
}

interface AvailabilitySlotDTO {
  start: string;
  end: string;
}

type CalculateAvailabilityResponse = Either<
  Error,
  {
    availableSlots: AvailabilitySlotDTO[];
    serverTime: string;
    timezone: string;
  }
>;

export class CalculateAvailabilityUseCase {
  constructor(
    private schedulesRepository: SchedulesRepository,
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
    private servicesRepository: ServicesRepository,
    private bookingsRepository: BookingsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private now: () => Date | Promise<Date> = () => new Date(),
  ) {}

  async execute({
    barbershopId,
    date,
    serviceIds,
    barbermanId,
  }: CalculateAvailabilityDTO): Promise<CalculateAvailabilityResponse> {
    // 1. Validar serviços únicos antes de ir ao banco
    const uniqueServiceIds = Array.from(new Set(serviceIds));
    if (uniqueServiceIds.length !== serviceIds.length) {
      return left(new Error("IDs de serviços duplicados."));
    }

    const targetDate = new Date(`${date}T12:00:00Z`);
    const dayOfWeekIndex = targetDate.getUTCDay();
    const daysMap = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    const dayOfWeek = daysMap[dayOfWeekIndex];

    const fetchSchedulesPromise = this.schedulesRepository
      .findManyByBarbershopAndDay
      ? this.schedulesRepository.findManyByBarbershopAndDay(
          barbershopId,
          dayOfWeek,
          barbermanId,
        )
      : this.schedulesRepository.findManyByBarbershopId(barbershopId);

    const fetchScopesPromise = this.schedulesRepository.findScopesForBarbershop
      ? this.schedulesRepository.findScopesForBarbershop(
          barbershopId,
          barbermanId,
        )
      : Promise.all([
          this.schedulesRepository.findScope(barbershopId, null),
          barbermanId
            ? this.schedulesRepository.findScope(barbershopId, barbermanId)
            : Promise.resolve(null),
        ]).then(([generalScope, barberScope]) => ({
          generalScope,
          barberScope,
        }));

    const [barbershop, services, allSchedules, scopes] = await Promise.all([
      this.barbershopsRepository.findById(barbershopId),
      this.servicesRepository.findManyActiveByBarbershopIdAndIds(
        barbershopId,
        uniqueServiceIds,
      ),
      fetchSchedulesPromise,
      fetchScopesPromise,
    ]);

    const timezone = barbershop?.timezone || "America/Sao_Paulo";
    const offset = getOffsetForTimezone(date, timezone);

    if (services.length !== uniqueServiceIds.length) {
      return left(
        new Error(
          "Um ou mais serviços não foram encontrados ou estão inativos para esta barbearia.",
        ),
      );
    }

    const totalDurationInMinutes = services.reduce(
      (total, service) => total + service.durationInMinutes,
      0,
    );

    const generalScopeState = scopes.generalScope?.state ?? null;
    const scopeState = barbermanId
      ? (scopes.barberScope?.state ?? null)
      : generalScopeState;

    const { intervals } =
      EffectiveScheduleResolver.resolveEffectiveDayIntervals({
        dayOfWeek,
        allSchedules,
        barbermanId,
        scopeState,
        generalScopeState,
      });

    if (intervals.length === 0) {
      return right({
        availableSlots: [],
        serverTime: (await this.now()).toISOString(),
        timezone,
      });
    }

    // 3. Buscar exceções do dia e agendamentos do dia em paralelo
    const nextDate = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);

    const fetchExceptionsPromise = this.scheduleExceptionsRepository
      .findManyByBarbershopAndDate
      ? this.scheduleExceptionsRepository.findManyByBarbershopAndDate(
          barbershopId,
          date,
          barbermanId,
        )
      : this.scheduleExceptionsRepository
          .findManyByBarbershopId(barbershopId)
          .then((allExceptions) =>
            allExceptions.filter((e) => {
              const eDate = new Date(e.date).toISOString().split("T")[0];
              const matchBarberman =
                !e.barbermanId ||
                (barbermanId && e.barbermanId?.toString() === barbermanId);
              return eDate === date && matchBarberman;
            }),
          );

    const fetchBookingsPromise = barbermanId
      ? this.bookingsRepository.findManyByBarbermanAndDate({
          barbermanId,
          date: targetDate,
          range: {
            startAt: new Date(`${date}T00:00:00${offset}`),
            endAt: new Date(
              `${nextDate}T00:00:00${getOffsetForTimezone(nextDate, timezone)}`,
            ),
          },
        })
      : Promise.resolve([]);

    const [dayExceptions, dayBookings] = await Promise.all([
      fetchExceptionsPromise,
      fetchBookingsPromise,
    ]);

    const closedAllDay = dayExceptions.some((e) => !e.startTime && !e.endTime);
    if (closedAllDay) {
      return right({
        availableSlots: [],
        serverTime: (await this.now()).toISOString(),
        timezone,
      });
    }

    // 5. Gerar os slots fatiados
    const availableSlots: AvailabilitySlotDTO[] = [];
    const SLOT_STEP_MINUTES = 30; // Fatias geradas a cada 30 minutos

    for (const schedule of intervals) {
      const openMinutes = timeToMinutes(schedule.openTime);
      const closeMinutes = timeToMinutes(schedule.closeTime);

      let currentStartMinutes = openMinutes;

      while (currentStartMinutes + totalDurationInMinutes <= closeMinutes) {
        const currentEndMinutes = currentStartMinutes + totalDurationInMinutes;
        const startStr = minutesToTime(currentStartMinutes);
        const endStr = minutesToTime(currentEndMinutes);
        const start = `${date}T${startStr}:00${offset}`;
        const end = `${date}T${endStr}:00${offset}`;

        const overlapsException = EffectiveScheduleResolver.overlapsException(
          startStr,
          endStr,
          dayExceptions.map((ex) => ({
            startTime: ex.startTime,
            endTime: ex.endTime,
            barbermanId: ex.barbermanId?.toString() ?? null,
          })),
          barbermanId,
        );

        const overlapsBooking = dayBookings.some((booking) => {
          if (booking.status === "CANCELLED") return false;
          if (booking.startsAt && booking.endsAt) {
            return (
              Date.parse(start) < booking.endsAt.getTime() &&
              Date.parse(end) > booking.startsAt.getTime()
            );
          }
          const bStart = timeToMinutes(booking.startTime);
          const bEnd = timeToMinutes(booking.endTime);
          return currentStartMinutes < bEnd && currentEndMinutes > bStart;
        });

        if (!overlapsException && !overlapsBooking) {
          availableSlots.push({
            start,
            end,
          });
        }

        currentStartMinutes += SLOT_STEP_MINUTES;
      }
    }

    const serverTime = await this.now();
    return right({
      availableSlots: availableSlots.filter(
        (slot) => Date.parse(slot.start) > serverTime.getTime(),
      ),
      serverTime: serverTime.toISOString(),
      timezone,
    });
  }
}
