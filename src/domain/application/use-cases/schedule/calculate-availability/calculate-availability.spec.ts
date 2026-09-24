import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { CalculateAvailabilityUseCase } from "./calculate-availability";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { ScheduleException } from "../../../../enterprise/entities/schedule-exception";
import { Service } from "../../../../enterprise/entities/service";
import { Booking } from "../../../../enterprise/entities/booking";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryBookingsRepository: InMemoryBookingsRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: CalculateAvailabilityUseCase;

describe("Calculate Availability", () => {
  beforeEach(() => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();

    sut = new CalculateAvailabilityUseCase(
      inMemorySchedulesRepository,
      inMemoryScheduleExceptionsRepository,
      inMemoryServicesRepository,
      inMemoryBookingsRepository,
      inMemoryBarbershopsRepository,
    );

    inMemoryBarbershopsRepository.items.push(
      Barbershop.create(
        {
          name: "Test Barbershop",
          ownerId: new UniqueEntityId("owner-1"),
          timezone: "America/Sao_Paulo",
          slug: Slug.create("test-barbershop"),
          cnpj: "12345678901234",
          location: "Location",
          status: "ACTIVE",
        },
        new UniqueEntityId("shop-1"),
      ),
    );
  });

  it("should be able to calculate availability for a regular open day", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY", // 2026-09-15 is a Tuesday
        openTime: "08:00",
        closeTime: "10:00",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          title: "Corte",
          durationInMinutes: 45,
          priceInCents: 5000,
        },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      // 08:00 to 10:00 = 120 mins. Duration = 45. Step = 30 mins.
      // Slots generated:
      // 1. 08:00 to 08:45
      // 2. 08:30 to 09:15
      // 3. 09:00 to 09:45
      // 4. 09:30 to 10:15 (Exceeds closeTime 10:00, skipped)
      expect(result.value.availableSlots).toHaveLength(3);
      expect(result.value.availableSlots[0].start).toEqual(
        "2026-09-15T08:00:00-03:00",
      );
      expect(result.value.availableSlots[1].start).toEqual(
        "2026-09-15T08:30:00-03:00",
      );
    }
  });

  it("should support multiple daily schedules (lunch break)", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        dayOfWeek: "TUESDAY",
        createdBy: new UniqueEntityId("owner-1"),
        openTime: "08:00",
        closeTime: "12:00",
      }),
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        dayOfWeek: "TUESDAY",
        createdBy: new UniqueEntityId("owner-1"),
        openTime: "13:00",
        closeTime: "18:00",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        { title: "Corte", durationInMinutes: 60, priceInCents: 5000 },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      // 08:00 to 12:00 -> 08:00, 08:30, ..., 11:00 (since duration=60, 11:30+60=12:30 > 12:00)
      // Morning slots: 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00 (7 slots)
      // Afternoon slots: 13:00 to 18:00 -> 13:00 to 17:00 (9 slots)
      expect(result.value.availableSlots.length).toBe(16);

      const includesMidday = result.value.availableSlots.some((s) =>
        s.start.includes("T12:00"),
      );
      expect(includesMidday).toBe(false); // Lunch break is respected
    }
  });

  it("should filter out partial exceptions", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "08:00",
        closeTime: "12:00",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        { title: "Corte", durationInMinutes: 30, priceInCents: 5000 },
        new UniqueEntityId("service-1"),
      ),
    );

    inMemoryScheduleExceptionsRepository.items.push(
      ScheduleException.create({
        barbershopId: new UniqueEntityId("shop-1"),
        date: new Date("2026-09-15"), // Tuesday
        startTime: "09:00",
        endTime: "10:00",
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      // 08:00 to 12:00 stepping 30.
      // Exception: 09:00 to 10:00.
      // Slots: 08:00, 08:30, (09:00 excluded), (09:30 excluded), 10:00, 10:30, 11:00, 11:30
      const starts = result.value.availableSlots.map((s) => s.start);
      expect(starts).toContain("2026-09-15T08:30:00-03:00");
      expect(starts).not.toContain("2026-09-15T09:00:00-03:00");
      expect(starts).not.toContain("2026-09-15T09:30:00-03:00");
      expect(starts).toContain("2026-09-15T10:00:00-03:00");
    }
  });

  it("should filter out booked slots", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "08:00",
        closeTime: "12:00",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        { title: "Corte", durationInMinutes: 30, priceInCents: 5000 },
        new UniqueEntityId("service-1"),
      ),
    );

    inMemoryBookingsRepository.items.push(
      Booking.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: new Date("2026-09-15"),
        startTime: "10:00",
        endTime: "10:30",
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      const starts = result.value.availableSlots.map((s) => s.start);
      expect(starts).not.toContain("2026-09-15T10:00:00-03:00");
      // 09:30 ends at 10:00, so it does NOT overlap with 10:00 booking
      expect(starts).toContain("2026-09-15T09:30:00-03:00");
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
