import { type Either, left, right } from "@/core/logic/either";
import type { SchedulesRepository } from "../../repositories/schedules-repository";
import type { ScheduleExceptionsRepository } from "../../repositories/schedule-exceptions-repository";
import type { ServicesRepository } from "../../repositories/services-repository";

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

    const schedules =
      await this.schedulesRepository.findManyByBarbershopId(barbershopId);

    // Filtrar pela jornada específica ou do estabelecimento
    const currentSchedule = schedules.find(
      (s) =>
        s.dayOfWeek === dayOfWeek &&
        (barbermanId
          ? s.barbermanId?.toString() === barbermanId
          : !s.barbermanId),
    );

    if (!currentSchedule) {
      // Regra: ausência de linha = fechado
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

    // Se houver uma exceção que fecha o dia todo (startTime e endTime null)
    const closedAllDay = dayExceptions.some((e) => !e.startTime && !e.endTime);
    if (closedAllDay) {
      return right({ availableSlots: [] });
    }

    // Mock simples: retornamos o horário de abertura até fechamento como um slot inteiro
    // Isso é suficiente para mock frontend, posteriormente o motor real dividirá em slots baseados em totalDurationInMinutes
    // e removerá os períodos exatos das exceptions
    const availableSlots: AvailabilitySlotDTO[] = [
      {
        start: `${date}T${currentSchedule.openTime}:00-03:00`,
        end: `${date}T${currentSchedule.closeTime}:00-03:00`,
      },
    ];

    return right({ availableSlots });
  }
}
