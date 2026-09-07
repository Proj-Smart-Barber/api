import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { CreateBookingUseCase } from "./create-booking";
import { BookingConflictError } from "../../_errors/booking-conflict-error";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: CreateBookingUseCase;

describe("Create Booking Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new CreateBookingUseCase(inMemoryBookingsRepository);
  });

  it("deve ser possível criar um novo agendamento", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
      shoppingCartId: "cart-1",
      startAt: new Date(2026, 9, 10, 10, 0),
      durationInMinutes: 30,
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryBookingsRepository.items).toHaveLength(1);
    expect(inMemoryBookingsRepository.items[0].barbermanId.toString()).toBe(
      "barber-1",
    );
  });

  it("não deve ser possível agendar no mesmo horário para o mesmo barbeiro", async () => {
    const startAt = new Date(2026, 9, 10, 10, 0);

    await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
      shoppingCartId: "cart-1",
      startAt,
      durationInMinutes: 60,
    });

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
      shoppingCartId: "cart-2",
      startAt: new Date(2026, 9, 10, 10, 30),
      durationInMinutes: 30,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingConflictError);
  });
});
