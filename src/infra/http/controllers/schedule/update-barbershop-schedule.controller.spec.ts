import { describe, beforeEach, it, expect, vi } from "vitest";
import { UpdateBarbershopScheduleController } from "./update-barbershop-schedule.controller";
import { UpdateBarbershopScheduleUseCase } from "../../../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemorySchedulesRepository } from "../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryBookingsRepository } from "../../../../../test/repositories/in-memory-bookings-repository";
import { Barbershop } from "../../../../domain/enterprise/entities/barbershop";
import { BarbershopSchedule } from "../../../../domain/enterprise/entities/barbershop-schedule";
import { Booking } from "../../../../domain/enterprise/entities/booking";
import { Slug } from "../../../../domain/enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import {
  Membership,
  Role,
} from "../../../../domain/enterprise/entities/membership";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryBookingsRepository: InMemoryBookingsRepository;
let updateBarbershopScheduleUseCase: UpdateBarbershopScheduleUseCase;
let controller: UpdateBarbershopScheduleController;

const ownerId = "11111111-1111-4111-8111-111111111111";
const barberId = "22222222-2222-4222-8222-222222222222";
const nonMemberId = "33333333-3333-4333-8333-333333333333";
let shopId: string;

describe("UpdateBarbershopScheduleController", () => {
  beforeEach(async () => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    updateBarbershopScheduleUseCase = new UpdateBarbershopScheduleUseCase(
      inMemorySchedulesRepository,
      inMemoryBarbershopsRepository,
      inMemoryBookingsRepository,
    );
    controller = new UpdateBarbershopScheduleController(
      updateBarbershopScheduleUseCase,
    );

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Alpha",
        ownerId: new UniqueEntityId(ownerId),
        slug: Slug.create("barbearia-alpha"),
        cnpj: "12345678000190",
        location: "Rua Alpha, 100",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-alpha-id"),
    );
    inMemoryBarbershopsRepository.items.push(barbershop);
    shopId = barbershop.id.toString();

    // Owner membership
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId(shopId),
        userId: new UniqueEntityId(ownerId),
        role: Role.OWNER,
      }),
    );

    // Barber membership
    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId(shopId),
        userId: new UniqueEntityId(barberId),
        role: Role.BARBERMAN,
      }),
    );
  });

  it("should return 200 on successful schedule update", async () => {
    const response = await controller.handle({
      shopId,
      userId: ownerId,
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: "Jornada atualizada com sucesso.",
    });
  });

  it("should return 403 when user is not allowed (NotAllowedError)", async () => {
    const response = await controller.handle({
      shopId,
      userId: nonMemberId,
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toBe("Not allowed to perform this operation.");
  });

  it("should return 404 when barbershop does not exist (ResourceNotFoundError)", async () => {
    const response = await controller.handle({
      shopId: "non-existing-shop-id",
      userId: ownerId,
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toBe("Recurso não encontrado.");
  });

  it("should return 400 when domain rule fails (openTime >= closeTime)", async () => {
    const response = await controller.handle({
      shopId,
      userId: ownerId,
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "18:00",
          closeTime: "08:00",
        },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toBe(
      "O horário de fechamento deve ser maior que o de abertura.",
    );
  });

  it("should return 400 on Zod schema validation error", async () => {
    const response = await controller.handle({
      shopId,
      userId: "invalid-uuid", // Not a valid UUID
      schedules: [],
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  it("should return 500 on unexpected unhandled error", async () => {
    vi.spyOn(updateBarbershopScheduleUseCase, "execute").mockRejectedValueOnce(
      new Error("Database connection failure"),
    );

    const response = await controller.handle({
      shopId,
      userId: ownerId,
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: "Database connection failure",
    });
  });

  it("should return 409 when future booking conflict is detected (ScheduleBookingConflictError)", async () => {
    // Adiciona jornada geral da barbearia na segunda-feira
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId(shopId),
        createdBy: new UniqueEntityId(ownerId),
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
      }),
    );

    // Próxima segunda-feira
    const now = new Date();
    const currentDay = now.getUTCDay();
    let daysToAdd = (1 - currentDay + 7) % 7;
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

    const futureBooking = Booking.create(
      {
        barbershopId: new UniqueEntityId(shopId),
        barbermanId: new UniqueEntityId(barberId),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: futureDate,
        startTime: "14:00",
        endTime: "15:00",
      },
      new UniqueEntityId("booking-conflict-ctrl"),
    );
    await inMemoryBookingsRepository.create(futureBooking);

    // Tenta atualizar a jornada do barbeiro para fechar às 12:00, deixando a reserva das 14:00-15:00 de fora
    const response = await controller.handle({
      shopId,
      userId: barberId,
      barbermanId: barberId,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "12:00",
        },
      ],
    });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      code: "SCHEDULE_BOOKING_CONFLICT",
      message:
        "Existem agendamentos futuros confirmados que entram em conflito com a nova jornada.",
      error:
        "Existem agendamentos futuros confirmados que entram em conflito com a nova jornada.",
      conflicts: [
        {
          bookingId: "booking-conflict-ctrl",
          date: futureDate.toISOString().split("T")[0],
          startTime: "14:00",
          endTime: "15:00",
          barbermanId: barberId,
        },
      ],
    });
  });
});
