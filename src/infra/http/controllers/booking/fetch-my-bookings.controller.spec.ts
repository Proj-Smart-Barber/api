import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { InMemoryBookingsRepository } from "../../../../../test/repositories/in-memory-bookings-repository";
import { FetchMyBookingsController } from "./fetch-my-bookings.controller";
import { Booking } from "../../../../domain/enterprise/entities/booking";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import { BookingServiceItem } from "../../../../domain/enterprise/entities/booking-service-item";

describe("FetchMyBookingsController Unit Tests (Grupo 1)", () => {
  let inMemoryBookingsRepository: InMemoryBookingsRepository;
  let sut: FetchMyBookingsController;

  let customerId: string;
  let shopId: string;
  let barberId: string;

  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new FetchMyBookingsController(inMemoryBookingsRepository);
    customerId = randomUUID();
    shopId = randomUUID();
    barberId = randomUUID();
  });

  it("deve retornar lista vazia e serverTime quando não houver agendamentos", async () => {
    const response = await sut.handle({
      userId: customerId,
      view: "upcoming",
      limit: 1,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("bookings", []);
    expect(response.body).toHaveProperty("serverTime");
    expect(new Date((response.body as any).serverTime).getTime()).not.toBeNaN();
  });

  it("deve retornar o próximo agendamento futuro elegível mesmo com mais de 20 agendamentos no histórico", async () => {
    const now = new Date();

    // 25 agendamentos passados
    for (let i = 1; i <= 25; i++) {
      const pastStart = new Date(
        now.getTime() - (30 - i) * 24 * 60 * 60 * 1000,
      );
      const pastBooking = Booking.create({
        customerId: new UniqueEntityId(customerId),
        barbershopId: new UniqueEntityId(shopId),
        barbermanId: new UniqueEntityId(barberId),
        startsAt: pastStart,
        endsAt: new Date(pastStart.getTime() + 30 * 60 * 1000),
        status: "COMPLETED",
        totalPriceInCents: 5000,
        totalDurationInMinutes: 30,
      });
      await inMemoryBookingsRepository.create(pastBooking);
    }

    // 1 agendamento futuro CANCELADO (deve ser ignorado)
    const cancelledBooking = Booking.create({
      customerId: new UniqueEntityId(customerId),
      barbershopId: new UniqueEntityId(shopId),
      barbermanId: new UniqueEntityId(barberId),
      startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 2.5 * 60 * 60 * 1000),
      status: "CANCELLED",
      totalPriceInCents: 5000,
      totalDurationInMinutes: 30,
    });
    await inMemoryBookingsRepository.create(cancelledBooking);

    // 1 agendamento CONFIRMED mais próximo (daqui a 4 horas)
    const nextBooking = Booking.create({
      customerId: new UniqueEntityId(customerId),
      barbershopId: new UniqueEntityId(shopId),
      barbermanId: new UniqueEntityId(barberId),
      startsAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 4.5 * 60 * 60 * 1000),
      status: "CONFIRMED",
      totalPriceInCents: 6000,
      totalDurationInMinutes: 30,
    });
    await inMemoryBookingsRepository.create(nextBooking);

    // 1 agendamento CONFIRMED mais distante (daqui a 24 horas)
    const laterBooking = Booking.create({
      customerId: new UniqueEntityId(customerId),
      barbershopId: new UniqueEntityId(shopId),
      barbermanId: new UniqueEntityId(barberId),
      startsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 24.5 * 60 * 60 * 1000),
      status: "CONFIRMED",
      totalPriceInCents: 6000,
      totalDurationInMinutes: 30,
    });
    await inMemoryBookingsRepository.create(laterBooking);

    const response = await sut.handle({
      userId: customerId,
      view: "upcoming",
      limit: 1,
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).bookings).toHaveLength(1);
    expect((response.body as any).bookings[0].id).toBe(
      nextBooking.id.toString(),
    );
    expect((response.body as any).bookings[0].status).toBe("CONFIRMED");
    expect((response.body as any).serverTime).toBeDefined();
  });

  it("deve incluir atendimento CONFIRMED em andamento como próximo atendimento", async () => {
    const now = new Date();

    const inProgressBooking = Booking.create({
      customerId: new UniqueEntityId(customerId),
      barbershopId: new UniqueEntityId(shopId),
      barbermanId: new UniqueEntityId(barberId),
      startsAt: new Date(now.getTime() - 15 * 60 * 1000), // começou há 15 min
      endsAt: new Date(now.getTime() + 15 * 60 * 1000), // termina daqui a 15 min
      status: "CONFIRMED",
      totalPriceInCents: 7500,
      totalDurationInMinutes: 30,
    });
    await inMemoryBookingsRepository.create(inProgressBooking);

    const response = await sut.handle({
      userId: customerId,
      view: "upcoming",
      limit: 1,
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).bookings).toHaveLength(1);
    expect((response.body as any).bookings[0].id).toBe(
      inProgressBooking.id.toString(),
    );
  });

  it("deve manter a compatibilidade da listagem histórica sem view=upcoming", async () => {
    const now = new Date();

    for (let i = 1; i <= 5; i++) {
      const b = Booking.create({
        customerId: new UniqueEntityId(customerId),
        barbershopId: new UniqueEntityId(shopId),
        barbermanId: new UniqueEntityId(barberId),
        startsAt: new Date(now.getTime() - i * 60 * 60 * 1000),
        status: "COMPLETED",
        totalPriceInCents: 5000,
        totalDurationInMinutes: 30,
      });
      await inMemoryBookingsRepository.create(b);
    }

    const response = await sut.handle({
      userId: customerId,
      page: 1,
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).bookings).toHaveLength(5);
    expect((response.body as any).serverTime).toBeDefined();
  });
});
