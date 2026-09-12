import { type Either, left, right } from "@/core/logic/either";
import type { SchedulesRepository } from "@/domain/application/repositories/schedules-repository";
import type { ScheduleExceptionsRepository } from "@/domain/application/repositories/schedule-exceptions-repository";
import type { ServicesRepository } from "@/domain/application/repositories/services-repository";
import type { BookingsRepository } from "@/domain/application/repositories/bookings-repository";

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
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
  ) {}

  async execute({
    barbershopId,
    date,
    serviceIds,
    barbermanId,
  }: CalculateAvailabilityDTO): Promise<CalculateAvailabilityResponse> {
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
    const targetDate = new Date(date);
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
      const tDate = targetDate.toISOString().split("T")[0];
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
          date: targetDate,
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
            start: `${date}T${startStr}:00-03:00`,
            end: `${date}T${endStr}:00-03:00`,
          });
        }

        currentStartMinutes += SLOT_STEP_MINUTES;
      }
    }

    return right({ availableSlots });
  }
}
