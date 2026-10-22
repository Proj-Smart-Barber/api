import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { CalculateAvailabilityUseCase } from "./calculate-availability";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { BarbershopScheduleScope } from "../../../../enterprise/entities/barbershop-schedule-scope";
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
let serverNow: Date;

describe("Calculate Availability", () => {
  beforeEach(() => {
    serverNow = new Date("2026-09-01T00:00:00Z");
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
      () => serverNow,
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

  it.each([
    ["2026-10-21T21:57:00Z", []],
    ["2026-10-21T13:00:00Z", ["10:30", "11:00", "11:30"]],
    ["2026-10-22T02:59:59Z", []],
    [
      "2026-10-20T23:57:00Z",
      ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
    ],
  ])(
    "filters elapsed instants using shop timezone at %s",
    async (now, expected) => {
      serverNow = new Date(now);
      inMemorySchedulesRepository.items.push(
        BarbershopSchedule.create({
          barbershopId: new UniqueEntityId("shop-1"),
          createdBy: new UniqueEntityId("owner-1"),
          barbermanId: new UniqueEntityId("barber-1"),
          dayOfWeek: "WEDNESDAY",
          openTime: "09:00",
          closeTime: "12:00",
        }),
      );
      inMemoryServicesRepository.items.push(
        Service.create(
          {
            barbershopId: new UniqueEntityId("shop-1"),
            title: "Corte",
            durationInMinutes: 30,
            priceInCents: 4000,
          },
          new UniqueEntityId("service-1"),
        ),
      );
      const result = await sut.execute({
        barbershopId: "shop-1",
        date: "2026-10-21",
        serviceIds: ["service-1"],
        barbermanId: "barber-1",
      });
      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(
          result.value.availableSlots.map((slot) => slot.start.slice(11, 16)),
        ).toEqual(expected);
        expect(result.value.serverTime).toBe(serverNow.toISOString());
        expect(result.value.timezone).toBe("America/Sao_Paulo");
      }
    },
  );

  it("ignores cancelled bookings and blocks canonical overlap across another unit's civil date", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        dayOfWeek: "WEDNESDAY",
        openTime: "09:00",
        closeTime: "10:30",
      }),
    );
    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte",
          durationInMinutes: 30,
          priceInCents: 4000,
        },
        new UniqueEntityId("service-1"),
      ),
    );
    for (const [status, start, end] of [
      ["CONFIRMED", "12:00", "12:30"],
      ["CANCELLED", "12:30", "13:00"],
    ]) {
      inMemoryBookingsRepository.items.push(
        Booking.create({
          barbershopId: new UniqueEntityId("other-shop"),
          barbermanId: new UniqueEntityId("barber-1"),
          customerId: new UniqueEntityId("customer"),
          date: new Date("2026-10-22T00:00:00Z"),
          startTime: "01:00",
          endTime: "01:30",
          timezone: "Pacific/Auckland",
          status,
          startsAt: new Date(`2026-10-21T${start}:00Z`),
          endsAt: new Date(`2026-10-21T${end}:00Z`),
        }),
      );
    }
    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-10-21",
      serviceIds: ["service-1"],
      barbermanId: "barber-1",
    });
    if (!result.isRight()) throw result.value;
    expect(
      result.value.availableSlots.map((slot) => slot.start.slice(11, 16)),
    ).toEqual(["09:30", "10:00"]);
  });

  it("keeps the selected civil weekday in UTC+14 instead of using the previous UTC day", async () => {
    serverNow = new Date("2026-10-20T19:00:00Z");
    inMemoryBarbershopsRepository.items = [
      Barbershop.create(
        {
          name: "UTC14 fixture",
          ownerId: new UniqueEntityId("owner-1"),
          timezone: "Pacific/Kiritimati",
          slug: Slug.create("utc14-fixture"),
          cnpj: "12345678901234",
          location: "Fixture",
          status: "ACTIVE",
        },
        new UniqueEntityId("shop-1"),
      ),
    ];
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "WEDNESDAY",
        openTime: "09:00",
        closeTime: "10:00",
      }),
    );
    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Fixture",
          durationInMinutes: 30,
          priceInCents: 4000,
        },
        new UniqueEntityId("service-1"),
      ),
    );
    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-10-21",
      serviceIds: ["service-1"],
      barbermanId: "barber-1",
    });
    if (!result.isRight()) throw result.value;
    expect(result.value.availableSlots).toEqual([
      { start: "2026-10-21T09:30:00+14:00", end: "2026-10-21T10:00:00+14:00" },
    ]);
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
          barbershopId: new UniqueEntityId("shop-1"),
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
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte",
          durationInMinutes: 60,
          priceInCents: 5000,
        },
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
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte",
          durationInMinutes: 30,
          priceInCents: 5000,
        },
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
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte",
          durationInMinutes: 30,
          priceInCents: 5000,
        },
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
      {
        barbershopId: new UniqueEntityId("shop-1"),
        title: "Corte",
        priceInCents: 4000,
        durationInMinutes: 30,
      },
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
      {
        barbershopId: new UniqueEntityId("shop-1"),
        title: "Corte",
        priceInCents: 4000,
        durationInMinutes: 30,
      },
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

  it("should sum durations correctly for multiple services", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "09:00",
        closeTime: "11:00",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte",
          durationInMinutes: 45,
          priceInCents: 4000,
        },
        new UniqueEntityId("service-1"),
      ),
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Barba",
          durationInMinutes: 15,
          priceInCents: 3000,
        },
        new UniqueEntityId("service-2"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-09-15",
      serviceIds: ["service-1", "service-2"],
    });

    // Total duration: 45 + 15 = 60 mins.
    // 09:00 to 11:00 with duration 60 mins:
    // 09:00 -> 10:00
    // 09:30 -> 10:30
    // 10:00 -> 11:00
    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.availableSlots).toHaveLength(3);
    }
  });

  it("should not allow duplicate service IDs", async () => {
    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte",
          durationInMinutes: 30,
          priceInCents: 4000,
        },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-09-15",
      serviceIds: ["service-1", "service-1"],
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toBe("IDs de serviços duplicados.");
    }
  });

  it("should reject service belonging to another barbershop", async () => {
    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-2"), // different barbershop!
          title: "Corte de Outra Loja",
          durationInMinutes: 30,
          priceInCents: 4000,
        },
        new UniqueEntityId("service-other"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-09-15",
      serviceIds: ["service-other"],
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toBe(
        "Um ou mais serviços não foram encontrados ou estão inativos para esta barbearia.",
      );
    }
  });

  it("should reject inactive service", async () => {
    const inactiveService = Service.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        title: "Corte Antigo",
        durationInMinutes: 30,
        priceInCents: 4000,
        isActive: false,
      },
      new UniqueEntityId("service-inactive"),
    );
    inMemoryServicesRepository.items.push(inactiveService);

    const result = await sut.execute({
      barbershopId: "shop-1",
      date: "2026-09-15",
      serviceIds: ["service-inactive"],
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toBe(
        "Um ou mais serviços não foram encontrados ou estão inativos para esta barbearia.",
      );
    }
  });

  it("should produce slots from general schedule when barberman has scope INHERIT", async () => {
    // 1. Horário geral: Terça-feira (2026-09-15) das 08:00 às 10:00
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "08:00",
        closeTime: "10:00",
      }),
    );

    // 2. Barbeiro sem horários customizados mas com scope INHERIT
    await inMemorySchedulesRepository.saveScope(
      BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-inherit"),
        state: "INHERIT",
        version: 1,
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Cabelo",
          durationInMinutes: 30,
          priceInCents: 5000,
        },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-inherit",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      // 08:00-08:30, 08:30-09:00, 09:00-09:30, 09:30-10:00 -> 4 slots
      expect(result.value.availableSlots).toHaveLength(4);
      expect(result.value.availableSlots[0].start).toContain("08:00");
    }
  });

  it("should return 0 slots when barberman has scope CLOSED", async () => {
    // Horário geral existe
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "08:00",
        closeTime: "18:00",
      }),
    );

    // Barbeiro com semana fechada
    await inMemorySchedulesRepository.saveScope(
      BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-closed"),
        state: "CLOSED",
        version: 1,
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Cabelo",
          durationInMinutes: 30,
          priceInCents: 5000,
        },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-closed",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.availableSlots).toHaveLength(0);
    }
  });

  it("should bound CUSTOM barberman availability by unit general schedule hours (R2)", async () => {
    // Unidade abre 09:00 as 12:00
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "09:00",
        closeTime: "12:00",
      }),
    );

    // Barbeiro com CUSTOM das 08:00 as 15:00
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-wide"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "08:00",
        closeTime: "15:00",
      }),
    );

    await inMemorySchedulesRepository.saveScope(
      BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-wide"),
        state: "CUSTOM",
        version: 1,
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Cabelo",
          durationInMinutes: 30,
          priceInCents: 5000,
        },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-wide",
      date: "2026-09-15", // Tuesday
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      const starts = result.value.availableSlots.map((s) => s.start);
      // Não deve conter horários antes das 09:00 nem depois das 12:00
      expect(starts).not.toContain("2026-09-15T08:00:00-03:00");
      expect(starts).not.toContain("2026-09-15T08:30:00-03:00");
      expect(starts).toContain("2026-09-15T09:00:00-03:00");
      expect(starts).toContain("2026-09-15T11:30:00-03:00");
      expect(starts).not.toContain("2026-09-15T12:00:00-03:00");
    }
  });

  it("should apply unit-wide exceptions even when querying specific barberman (R2)", async () => {
    // Unidade abre 09:00 as 18:00
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "09:00",
        closeTime: "18:00",
      }),
    );

    // Exceção geral na unidade: feriado / fechado o dia todo (barbermanId null)
    inMemoryScheduleExceptionsRepository.items.push(
      ScheduleException.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: null,
        date: new Date("2026-09-15T12:00:00.000Z"),
        reason: "Feriado Municipal",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Cabelo",
          durationInMinutes: 30,
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
      expect(result.value.availableSlots).toHaveLength(0);
    }
  });

  it("should return 0 slots for legacy ambiguous barberman without scope and without schedules (R2)", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "09:00",
        closeTime: "18:00",
      }),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Cabelo",
          durationInMinutes: 30,
          priceInCents: 5000,
        },
        new UniqueEntityId("service-1"),
      ),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-without-schedule-or-scope",
      date: "2026-09-15",
      serviceIds: ["service-1"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.availableSlots).toHaveLength(0);
    }
  });
});
