import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import {
  UpdateBarbershopScheduleUseCase,
  getBookingStartUtc,
} from "./update-barbershop-schedule";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { Booking } from "../../../../enterprise/entities/booking";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { ScheduleBookingConflictError } from "../../_errors/schedule-booking-conflict-error";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: UpdateBarbershopScheduleUseCase;

describe("Update Barbershop Schedule", () => {
  beforeEach(async () => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new UpdateBarbershopScheduleUseCase(
      inMemorySchedulesRepository,
      inMemoryBarbershopsRepository,
      inMemoryBookingsRepository,
    );

    const barbershop = Barbershop.create(
      {
        name: "Test Shop",
        slug: Slug.create("test-shop"),
        timezone: "America/Sao_Paulo",
        ownerId: new UniqueEntityId("owner-1"),
        status: "ACTIVE",
        cnpj: "12.345.678/0001-90",
        location: "Rua de Teste, 123",
      },
      new UniqueEntityId("shop-1"),
    );

    inMemoryBarbershopsRepository.items.push(barbershop);

    // Vínculo do dono
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId("shop-1"),
        userId: new UniqueEntityId("owner-1"),
        role: Role.OWNER,
      }),
    );

    // Vínculo do barbeiro staff
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId("shop-1"),
        userId: new UniqueEntityId("barber-1"),
        role: Role.BARBERMAN,
      }),
    );

    // Jornada geral da barbearia (MONDAY 08:00 - 18:00)
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
        barbermanId: null,
      }),
    );
  });

  it("should allow owner to update general barbershop schedule (barbermanId null)", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "owner-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "20:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    expect(inMemorySchedulesRepository.items).toHaveLength(1);
    expect(inMemorySchedulesRepository.items[0].closeTime).toBe("20:00");
    expect(inMemorySchedulesRepository.items[0].barbermanId).toBeNull();
  });

  it("should not allow non-owner to update general barbershop schedule", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should allow linked barber to update their own schedule within shop hours", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    const barberSchedule = inMemorySchedulesRepository.items.find(
      (s) => s.barbermanId?.toString() === "barber-1",
    );
    expect(barberSchedule).toBeDefined();
    expect(barberSchedule?.openTime).toBe("09:00");
    expect(barberSchedule?.closeTime).toBe("17:00");
  });

  it("should allow barber to set multiple shifts in the same day", async () => {
    // Definir horário geral compatível com dois turnos
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "12:00",
        },
        {
          dayOfWeek: "MONDAY",
          openTime: "13:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    const barberSchedules = inMemorySchedulesRepository.items.filter(
      (s) => s.barbermanId?.toString() === "barber-1",
    );
    expect(barberSchedules).toHaveLength(2);
  });

  it("should not allow barber without active membership in the shop to update schedule", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-stranger",
      barbermanId: "barber-stranger",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should not allow a barber to update another barber schedule", async () => {
    // Criar outro barbeiro vinculado
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId("shop-1"),
        userId: new UniqueEntityId("barber-2"),
        role: Role.BARBERMAN,
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-2",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should allow shop owner to update a barber schedule", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "owner-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "10:00",
          closeTime: "16:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    const barberSchedule = inMemorySchedulesRepository.items.find(
      (s) => s.barbermanId?.toString() === "barber-1",
    );
    expect(barberSchedule).toBeDefined();
    expect(barberSchedule?.openTime).toBe("10:00");
    expect(barberSchedule?.closeTime).toBe("16:00");
  });

  it("should reject barber schedule exceeding shop general opening hours", async () => {
    // Barbearia abre 08:00 - 18:00. Barbeiro tenta abrir antes (07:00)
    const earlyResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "07:00",
          closeTime: "12:00",
        },
      ],
    });

    expect(earlyResult.isLeft()).toBe(true);
    if (earlyResult.isLeft()) {
      expect(earlyResult.value.message).toBe(
        "O período informado está fora do horário de funcionamento geral da barbearia.",
      );
    }

    // Barbeiro tenta fechar depois (19:00)
    const lateResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "12:00",
          closeTime: "19:00",
        },
      ],
    });

    expect(lateResult.isLeft()).toBe(true);
    if (lateResult.isLeft()) {
      expect(lateResult.value.message).toBe(
        "O período informado está fora do horário de funcionamento geral da barbearia.",
      );
    }
  });

  it("should reject barber schedule if shop is closed on that day", async () => {
    // Barbearia não tem horário cadastrado para SUNDAY
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "SUNDAY",
          openTime: "09:00",
          closeTime: "12:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toBe(
        "O período informado está fora do horário de funcionamento geral da barbearia.",
      );
    }
  });

  it("should reject schedule with overlapping time intervals on the same day", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "13:00",
        },
        {
          dayOfWeek: "MONDAY",
          openTime: "12:00",
          closeTime: "15:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toBe(
        "Horários sobrepostos no mesmo dia da semana.",
      );
    }
  });

  it("should allow empty schedules array to clear barber schedule without affecting general schedule", async () => {
    // Cadastrar previamente um horário para o barbeiro
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("barber-1"),
        dayOfWeek: "MONDAY",
        openTime: "09:00",
        closeTime: "17:00",
        barbermanId: new UniqueEntityId("barber-1"),
      }),
    );

    expect(inMemorySchedulesRepository.items).toHaveLength(2); // Geral + Barbeiro

    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [],
    });

    expect(result.isRight()).toBe(true);
    // Escala do barbeiro removida, escala geral mantida
    expect(inMemorySchedulesRepository.items).toHaveLength(1);
    expect(inMemorySchedulesRepository.items[0].barbermanId).toBeNull();
  });

  it("should not be able to create a schedule if openTime is greater or equal to closeTime", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "owner-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "18:00",
          closeTime: "08:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toBe(
        "O horário de fechamento deve ser maior que o de abertura.",
      );
    }
  });

  it("should return ResourceNotFoundError if barbershop does not exist", async () => {
    const result = await sut.execute({
      barbershopId: "non-existent-shop",
      createdBy: "owner-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not allow owner to update schedule of a professional without active membership in the shop", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "owner-1",
      barbermanId: "barber-stranger",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "10:00",
          closeTime: "16:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should ensure updating barber schedule does not alter or remove general barbershop schedule", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);

    const generalSchedule = inMemorySchedulesRepository.items.find(
      (s) => s.barbermanId === null,
    );
    expect(generalSchedule).toBeDefined();
    expect(generalSchedule?.openTime).toBe("08:00");
    expect(generalSchedule?.closeTime).toBe("18:00");
  });

  it("should ensure updating barber A schedule does not affect barber B schedule", async () => {
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId("shop-1"),
        userId: new UniqueEntityId("barber-2"),
        role: Role.BARBERMAN,
      }),
    );

    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "MONDAY",
        openTime: "10:00",
        closeTime: "16:00",
        barbermanId: new UniqueEntityId("barber-2"),
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "barber-1",
      barbermanId: "barber-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "12:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);

    const barber2Schedule = inMemorySchedulesRepository.items.find(
      (s) => s.barbermanId?.toString() === "barber-2",
    );
    expect(barber2Schedule).toBeDefined();
    expect(barber2Schedule?.openTime).toBe("10:00");
    expect(barber2Schedule?.closeTime).toBe("16:00");
  });

  it("should allow shop owner to configure their own individual schedule as active barber when having membership", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "owner-1",
      barbermanId: "owner-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    const ownerSchedule = inMemorySchedulesRepository.items.find(
      (s) => s.barbermanId?.toString() === "owner-1",
    );
    expect(ownerSchedule).toBeDefined();
    expect(ownerSchedule?.openTime).toBe("09:00");
    expect(ownerSchedule?.closeTime).toBe("17:00");
  });

  it("should reject individual schedule update if owner has no membership registered for the shop", async () => {
    inMemoryBarbershopsRepository.memberships = [];

    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "owner-1",
      barbermanId: "owner-1",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  describe("TEC-14 Future Bookings Protection", () => {
    function getNextDayOfWeek(targetDayOfWeek: number): {
      date: Date;
      dateStr: string;
    } {
      const now = new Date();
      const currentDay = now.getUTCDay();
      let daysToAdd = (targetDayOfWeek - currentDay + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      const futureDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + daysToAdd,
          0,
          0,
          0,
          0,
        ),
      );
      const dateStr = futureDate.toISOString().split("T")[0];
      return { date: futureDate, dateStr };
    }

    it("should reject individual schedule update when future booking of the barber falls outside proposed schedule", async () => {
      const { date, dateStr } = getNextDayOfWeek(1); // Next Monday

      const futureBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          barbermanId: new UniqueEntityId("barber-1"),
          shoppingCartId: new UniqueEntityId("cart-1"),
          date,
          startTime: "14:00",
          endTime: "15:00",
        },
        new UniqueEntityId("booking-conflict-1"),
      );
      await inMemoryBookingsRepository.create(futureBooking);

      const result = await sut.execute({
        barbershopId: "shop-1",
        createdBy: "barber-1",
        barbermanId: "barber-1",
        schedules: [
          {
            dayOfWeek: "MONDAY",
            openTime: "09:00",
            closeTime: "12:00", // Leaves 14:00-15:00 outside!
          },
        ],
      });

      expect(result.isLeft()).toBe(true);
      expect(result.value).toBeInstanceOf(ScheduleBookingConflictError);

      const error = result.value as ScheduleBookingConflictError;
      expect(error.code).toBe("SCHEDULE_BOOKING_CONFLICT");
      expect(error.conflictingBookings).toEqual([
        {
          bookingId: "booking-conflict-1",
          date: dateStr,
          startTime: "14:00",
          endTime: "15:00",
          barbermanId: "barber-1",
        },
      ]);

      // Garante que a jornada NÃO foi salva
      const currentSchedules =
        await inMemorySchedulesRepository.findManyByBarbershopId("shop-1");
      const barberSchedules = currentSchedules.filter(
        (s) => s.barbermanId?.toString() === "barber-1",
      );
      expect(barberSchedules).toHaveLength(0);
    });

    it("should reject general schedule update when future booking of ANY barber falls outside proposed general schedule", async () => {
      const { date, dateStr } = getNextDayOfWeek(1); // Next Monday

      const futureBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          barbermanId: new UniqueEntityId("barber-1"),
          shoppingCartId: new UniqueEntityId("cart-1"),
          date,
          startTime: "17:00",
          endTime: "18:00",
        },
        new UniqueEntityId("booking-conflict-general"),
      );
      await inMemoryBookingsRepository.create(futureBooking);

      // Dono tenta reduzir o horário geral para 08:00-16:00
      const result = await sut.execute({
        barbershopId: "shop-1",
        createdBy: "owner-1",
        barbermanId: null,
        schedules: [
          {
            dayOfWeek: "MONDAY",
            openTime: "08:00",
            closeTime: "16:00",
          },
        ],
      });

      expect(result.isLeft()).toBe(true);
      expect(result.value).toBeInstanceOf(ScheduleBookingConflictError);

      const error = result.value as ScheduleBookingConflictError;
      expect(error.conflictingBookings).toEqual([
        {
          bookingId: "booking-conflict-general",
          date: dateStr,
          startTime: "17:00",
          endTime: "18:00",
          barbermanId: "barber-1",
        },
      ]);
    });

    it("should reject schedule update when future booking falls into a split shift pause (gap)", async () => {
      const { date } = getNextDayOfWeek(1);

      const futureBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          barbermanId: new UniqueEntityId("barber-1"),
          shoppingCartId: new UniqueEntityId("cart-1"),
          date,
          startTime: "12:30",
          endTime: "13:30",
        },
        new UniqueEntityId("booking-in-gap"),
      );
      await inMemoryBookingsRepository.create(futureBooking);

      const result = await sut.execute({
        barbershopId: "shop-1",
        createdBy: "barber-1",
        barbermanId: "barber-1",
        schedules: [
          {
            dayOfWeek: "MONDAY",
            openTime: "08:00",
            closeTime: "12:00",
          },
          {
            dayOfWeek: "MONDAY",
            openTime: "14:00",
            closeTime: "18:00",
          },
        ],
      });

      expect(result.isLeft()).toBe(true);
      expect(result.value).toBeInstanceOf(ScheduleBookingConflictError);
    });

    it("should allow schedule update when booking is in the past (does not block schedule update)", async () => {
      const pastDate = new Date("2020-01-06T00:00:00.000Z"); // Past Monday

      const pastBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          barbermanId: new UniqueEntityId("barber-1"),
          shoppingCartId: new UniqueEntityId("cart-1"),
          date: pastDate,
          startTime: "14:00",
          endTime: "15:00",
        },
        new UniqueEntityId("past-booking-1"),
      );
      await inMemoryBookingsRepository.create(pastBooking);

      const result = await sut.execute({
        barbershopId: "shop-1",
        createdBy: "barber-1",
        barbermanId: "barber-1",
        schedules: [
          {
            dayOfWeek: "MONDAY",
            openTime: "09:00",
            closeTime: "12:00",
          },
        ],
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.schedules).toHaveLength(1);
      }
    });

    it("should allow schedule update when future bookings fit completely within the new shifts", async () => {
      const { date } = getNextDayOfWeek(1);

      const futureBooking = Booking.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          barbermanId: new UniqueEntityId("barber-1"),
          shoppingCartId: new UniqueEntityId("cart-1"),
          date,
          startTime: "10:00",
          endTime: "11:00",
        },
        new UniqueEntityId("fitting-booking-1"),
      );
      await inMemoryBookingsRepository.create(futureBooking);

      const result = await sut.execute({
        barbershopId: "shop-1",
        createdBy: "barber-1",
        barbermanId: "barber-1",
        schedules: [
          {
            dayOfWeek: "MONDAY",
            openTime: "09:00",
            closeTime: "12:00",
          },
          {
            dayOfWeek: "MONDAY",
            openTime: "14:00",
            closeTime: "18:00",
          },
        ],
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.schedules).toHaveLength(2);
      }
    });

    it("should detect conflict when UTC date rolled over (between 00:00 and 03:00Z) but local shop time is still in the previous civil date", async () => {
      // Configura o relógio do sistema para 01:30 UTC do dia 15 (que é 22:30 de 14/10 em America/Sao_Paulo UTC-3)
      vi.useFakeTimers();
      const mockNowUtc = new Date("2026-10-15T01:30:00.000Z");
      vi.setSystemTime(mockNowUtc);

      try {
        // Horário geral da barbearia para WEDNESDAY (08:00 - 23:59)
        inMemorySchedulesRepository.items.push(
          BarbershopSchedule.create({
            barbershopId: new UniqueEntityId("shop-1"),
            createdBy: new UniqueEntityId("owner-1"),
            dayOfWeek: "WEDNESDAY",
            openTime: "08:00",
            closeTime: "23:59",
            barbermanId: null,
          }),
        );

        // Agendamento no dia civil 14/10 (WEDNESDAY), das 23:00 às 23:30.
        // No fuso America/Sao_Paulo, 23:00 equivale a 02:00Z do dia 15, que é POSTERIOR a 01:30Z (mockNowUtc).
        const civilDate14 = new Date(Date.UTC(2026, 9, 14, 0, 0, 0, 0)); // 2026-10-14T00:00:00.000Z (quarta-feira)
        const bookingLateNight = Booking.create(
          {
            barbershopId: new UniqueEntityId("shop-1"),
            barbermanId: new UniqueEntityId("barber-1"),
            shoppingCartId: new UniqueEntityId("cart-1"),
            date: civilDate14,
            startTime: "23:00",
            endTime: "23:30",
          },
          new UniqueEntityId("late-night-booking-1"),
        );
        await inMemoryBookingsRepository.create(bookingLateNight);

        // Tenta alterar a jornada individual de WEDNESDAY fechando às 22:00 (deixando o agendamento das 23:00 de fora)
        const result = await sut.execute({
          barbershopId: "shop-1",
          createdBy: "barber-1",
          barbermanId: "barber-1",
          schedules: [
            {
              dayOfWeek: "WEDNESDAY",
              openTime: "09:00",
              closeTime: "22:00",
            },
          ],
        });

        // Deve identificar o conflito e retornar 409 / ScheduleBookingConflictError
        expect(result.isLeft()).toBe(true);
        expect(result.value).toBeInstanceOf(ScheduleBookingConflictError);

        const error = result.value as ScheduleBookingConflictError;
        expect(error.code).toBe("SCHEDULE_BOOKING_CONFLICT");
        expect(error.conflictingBookings).toEqual([
          {
            bookingId: "late-night-booking-1",
            date: "2026-10-14",
            startTime: "23:00",
            endTime: "23:30",
            barbermanId: "barber-1",
          },
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should correctly handle DST transitions (Europe/Berlin on 2026-03-29 01:30 local) and detect conflict with exact 00:30Z UTC time", async () => {
      // 1. Validação isolada do algoritmo convergente na transição de horário de verão (DST)
      const exactUtc = getBookingStartUtc(
        "2026-03-29",
        "01:30",
        "Europe/Berlin",
      );
      expect(exactUtc.toISOString()).toBe("2026-03-29T00:30:00.000Z");

      // 2. Simulação temporal no use case:
      // O relógio do sistema está fixado em 00:00Z de 29/03/2026 (01:00 local em Berlim).
      // Um booking futuro existe às 01:30 local (00:30Z, daqui a 30 minutos).
      vi.useFakeTimers();
      const mockNowUtc = new Date("2026-03-29T00:00:00.000Z");
      vi.setSystemTime(mockNowUtc);

      try {
        const berlinShop = Barbershop.create(
          {
            name: "Berlin Barber",
            slug: Slug.create("berlin-barber"),
            timezone: "Europe/Berlin",
            ownerId: new UniqueEntityId("owner-berlin"),
            status: "ACTIVE",
            cnpj: "99.999.999/0001-99",
            location: "Berlin, Germany",
          },
          new UniqueEntityId("shop-berlin"),
        );
        inMemoryBarbershopsRepository.items.push(berlinShop);

        inMemoryBarbershopsRepository.memberships.push(
          Membership.create({
            barbershopId: new UniqueEntityId("shop-berlin"),
            userId: new UniqueEntityId("barber-berlin"),
            role: Role.BARBERMAN,
          }),
        );

        // Grade geral de domingo (SUNDAY) na barbearia de Berlim
        inMemorySchedulesRepository.items.push(
          BarbershopSchedule.create({
            barbershopId: new UniqueEntityId("shop-berlin"),
            createdBy: new UniqueEntityId("owner-berlin"),
            dayOfWeek: "SUNDAY",
            openTime: "00:00",
            closeTime: "23:59",
            barbermanId: null,
          }),
        );

        // Booking agendado para 29/03/2026 (SUNDAY) das 01:30 às 02:00 local (00:30Z UTC)
        const date29 = new Date(Date.UTC(2026, 2, 29, 0, 0, 0, 0));
        const bookingInDstTransition = Booking.create(
          {
            barbershopId: new UniqueEntityId("shop-berlin"),
            barbermanId: new UniqueEntityId("barber-berlin"),
            shoppingCartId: new UniqueEntityId("cart-berlin"),
            date: date29,
            startTime: "01:30",
            endTime: "02:00",
          },
          new UniqueEntityId("dst-booking-1"),
        );
        await inMemoryBookingsRepository.create(bookingInDstTransition);

        // Tenta atualizar a jornada individual de domingo para 09:00 - 18:00 (deixando 01:30 de fora)
        const result = await sut.execute({
          barbershopId: "shop-berlin",
          createdBy: "barber-berlin",
          barbermanId: "barber-berlin",
          schedules: [
            {
              dayOfWeek: "SUNDAY",
              openTime: "09:00",
              closeTime: "18:00",
            },
          ],
        });

        // O algoritmo correto (00:30Z > 00:00Z) identifica o booking como FUTURO e acusa colisão (409)
        expect(result.isLeft()).toBe(true);
        expect(result.value).toBeInstanceOf(ScheduleBookingConflictError);

        const error = result.value as ScheduleBookingConflictError;
        expect(error.code).toBe("SCHEDULE_BOOKING_CONFLICT");
        expect(error.conflictingBookings).toEqual([
          {
            bookingId: "dst-booking-1",
            date: "2026-03-29",
            startTime: "01:30",
            endTime: "02:00",
            barbermanId: "barber-berlin",
          },
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
