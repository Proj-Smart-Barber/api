import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { CalculateAvailabilityUseCase } from "./calculate-availability";
import { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";
import { Service } from "@/domain/enterprise/entities/service";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: CalculateAvailabilityUseCase;

describe("Calculate Availability", () => {
  beforeEach(() => {
    // 1. Instanciamos todos os 3 repositórios em memória e jogamos no Use Case
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();

    sut = new CalculateAvailabilityUseCase(
      inMemorySchedulesRepository,
      inMemoryScheduleExceptionsRepository,
      inMemoryServicesRepository,
    );
  });

  it("should be able to calculate availability for a regular open day", async () => {
    // Setup Service
    const service = Service.create(
      { title: "Corte", priceInCents: 4000, durationInMinutes: 30 },
      new UniqueEntityId("service-1"),
    );
    inMemoryServicesRepository.items.push(service);

    // Setup Schedule (Quinta-feira = THURSDAY)
    const schedule = BarbershopSchedule.create({
      barbershopId: new UniqueEntityId("shop-1"),
      createdBy: new UniqueEntityId("owner"),
      dayOfWeek: "THURSDAY",
      openTime: "09:00",
      closeTime: "18:00",
    });
    inMemorySchedulesRepository.items.push(schedule);

    // Execução: Dia 2026-10-15 é uma Quinta-feira
    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-10-15",
      serviceIds: ["service-1"],
    });

    // Verificação: Deve retornar o nosso mock com o horário de início (09:00)
    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.availableSlots).toHaveLength(1);
      expect(result.value.availableSlots[0].start).toContain("09:00");
    }
  });

  it("should return empty slots if there is no schedule for the day (Closed)", async () => {
    const service = Service.create(
      { title: "Corte", priceInCents: 4000, durationInMinutes: 30 },
      new UniqueEntityId("service-1"),
    );
    inMemoryServicesRepository.items.push(service);

    // Sem cadastrar NENHUM Schedule no repositório...

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-10-15",
      serviceIds: ["service-1"],
    });

    // Como o dia não tem linha na tabela, deve retornar array vazio
    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.availableSlots).toHaveLength(0);
    }
  });

  it("should return empty slots if there is a full day exception (Holiday)", async () => {
    const service = Service.create(
      { title: "Corte", priceInCents: 4000, durationInMinutes: 30 },
      new UniqueEntityId("service-1"),
    );
    inMemoryServicesRepository.items.push(service);

    const schedule = BarbershopSchedule.create({
      barbershopId: new UniqueEntityId("shop-1"),
      createdBy: new UniqueEntityId("owner"),
      dayOfWeek: "THURSDAY",
      openTime: "09:00",
      closeTime: "18:00",
    });
    inMemorySchedulesRepository.items.push(schedule);

    // Setup de Exceção para o dia inteiro (startTime nulo)
    const exception = ScheduleException.create({
      barbershopId: new UniqueEntityId("shop-1"),
      date: new Date("2026-10-15"),
      reason: "Feriado",
    });
    inMemoryScheduleExceptionsRepository.items.push(exception);

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-10-15",
      serviceIds: ["service-1"],
    });

    // Mesmo com a jornada criada, a exceção (feriado) sobressai e zera os slots
    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.availableSlots).toHaveLength(0);
    }
  });
});
