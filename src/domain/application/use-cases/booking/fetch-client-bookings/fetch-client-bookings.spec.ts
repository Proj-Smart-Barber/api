import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { FetchClientBookingsUseCase } from "./fetch-client-bookings";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: FetchClientBookingsUseCase;

describe("Fetch Client Bookings Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new FetchClientBookingsUseCase(inMemoryBookingsRepository);
  });

  it("deve ser possível listar os agendamentos do carrinho de um cliente", async () => {
    const today = new Date();

    const booking1 = Booking.create({
      barbershopId: new UniqueEntityId("shop-1"),
      barbermanId: new UniqueEntityId("barber-1"),
      shoppingCartId: new UniqueEntityId("cart-1"),
      date: today,
      startTime: "09:00",
      endTime: "10:00",
    });

    const booking2 = Booking.create({
      barbershopId: new UniqueEntityId("shop-1"),
      barbermanId: new UniqueEntityId("barber-2"),
      shoppingCartId: new UniqueEntityId("cart-1"),
      date: today,
      startTime: "11:00",
      endTime: "12:00",
    });

    await inMemoryBookingsRepository.create(booking1);
    await inMemoryBookingsRepository.create(booking2);

    const result = await sut.execute({
      shoppingCartId: "cart-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.bookings).toHaveLength(2);
    }
  });
});
