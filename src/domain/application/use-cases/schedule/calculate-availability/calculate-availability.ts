import { type Either, left, right } from "../../../../../core/logic/either";
import type { SchedulesRepository } from "../../../repositories/schedules-repository";
import type { ScheduleExceptionsRepository } from "../../../repositories/schedule-exceptions-repository";
import type { ServicesRepository } from "../../../repositories/services-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";

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
  { availableSlots: AvailabilitySlotDTO[] }
>;

export class CalculateAvailabilityUseCase {
  constructor(
    private schedulesRepository: SchedulesRepository,
    private scheduleExceptionsRepository: ScheduleExceptionsRepository,
    private servicesRepository: ServicesRepository,
    private bookingsRepository: BookingsRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    barbershopId,
    date,
    serviceIds,
    barbermanId,
  }: CalculateAvailabilityDTO): Promise<CalculateAvailabilityResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);
    const timezone = barbershop?.timezone || "America/Sao_Paulo";
    const offset = getOffsetForTimezone(date, timezone);

    // 1. Calcular a duração total dos serviços
    const services = await this.servicesRepository.findManyByIds(serviceIds);
    if (services.length !== serviceIds.length) {
      return left(new Error("Um ou mais serviços não foram encontrados."));
    }

    const totalDurationInMinutes = services.reduce(
      (total, service) => total + service.durationInMinutes,
      0,
    );

    // 2. Buscar a jornada para o dia da semana
    const targetDate = new Date(`${date}T12:00:00${offset}`);
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

    const allSchedules =
      await this.schedulesRepository.findManyByBarbershopId(barbershopId);

    const daySchedules = allSchedules.filter(
      (s) =>
        s.dayOfWeek === dayOfWeek &&
        (barbermanId
          ? s.barbermanId?.toString() === barbermanId
          : !s.barbermanId),
    );

    if (daySchedules.length === 0) {
      return right({ availableSlots: [] });
    }

    // 3. Buscar exceções do dia
    const allExceptions =
      await this.scheduleExceptionsRepository.findManyByBarbershopId(
        barbershopId,
      );

    const dayExceptions = allExceptions.filter((e) => {
      const eDate = new Date(e.date).toISOString().split("T")[0];
      const tDate = date; // date from parameter
      const matchBarberman = barbermanId
        ? e.barbermanId?.toString() === barbermanId
        : !e.barbermanId;
      return eDate === tDate && matchBarberman;
    });

    const closedAllDay = dayExceptions.some((e) => !e.startTime && !e.endTime);
    if (closedAllDay) {
      return right({ availableSlots: [] });
    }

    // 4. Buscar Bookings do dia
    const dayBookings = barbermanId
      ? await this.bookingsRepository.findManyByBarbermanAndDate({
          barbermanId,
          date: targetDate, // we pass the Date object which represents the correct day
        })
      : [];

    // 5. Gerar os slots fatiados
    const availableSlots: AvailabilitySlotDTO[] = [];
    const SLOT_STEP_MINUTES = 30; // Fatias geradas a cada 30 minutos

    for (const schedule of daySchedules) {
      const openMinutes = timeToMinutes(schedule.openTime);
      const closeMinutes = timeToMinutes(schedule.closeTime);

      let currentStartMinutes = openMinutes;

      while (currentStartMinutes + totalDurationInMinutes <= closeMinutes) {
        const currentEndMinutes = currentStartMinutes + totalDurationInMinutes;

        const overlapsException = dayExceptions.some((ex) => {
          if (!ex.startTime || !ex.endTime) return true;
          const exStart = timeToMinutes(ex.startTime);
          const exEnd = timeToMinutes(ex.endTime);
          return currentStartMinutes < exEnd && currentEndMinutes > exStart;
        });

        const overlapsBooking = dayBookings.some((booking) => {
          const bStart = timeToMinutes(booking.startTime);
          const bEnd = timeToMinutes(booking.endTime);
          return currentStartMinutes < bEnd && currentEndMinutes > bStart;
        });

        if (!overlapsException && !overlapsBooking) {
          const startStr = minutesToTime(currentStartMinutes);
          const endStr = minutesToTime(currentEndMinutes);

          availableSlots.push({
            start: `${date}T${startStr}:00${offset}`,
            end: `${date}T${endStr}:00${offset}`,
          });
        }

        currentStartMinutes += SLOT_STEP_MINUTES;
      }
    }

    return right({ availableSlots });
  }
}
