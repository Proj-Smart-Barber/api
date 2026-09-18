import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { FetchBarbermanDailyScheduleUseCase } from "./fetch-barberman-daily-schedule";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: FetchBarbermanDailyScheduleUseCase;

describe("Fetch Barberman Daily Schedule Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new FetchBarbermanDailyScheduleUseCase(inMemoryBookingsRepository);
  });

  it("should be able to fetch daily schedule for a barberman", async () => {
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
      barbermanId: new UniqueEntityId("barber-1"),
      shoppingCartId: new UniqueEntityId("cart-2"),
      date: today,
      startTime: "10:00",
      endTime: "11:00",
    });

    await inMemoryBookingsRepository.create(booking1);
    await inMemoryBookingsRepository.create(booking2);

    const result = await sut.execute({
      barbermanId: "barber-1",
      date: today,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.bookings).toHaveLength(2);
    }
  });
});
