import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { FetchBarbermanDailyScheduleWithDetailsUseCase } from "./fetch-barberman-daily-schedule-with-details";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: FetchBarbermanDailyScheduleWithDetailsUseCase;

describe("Fetch Barberman Daily Schedule With Details Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new FetchBarbermanDailyScheduleWithDetailsUseCase(
      inMemoryBookingsRepository,
    );
  });

  it("should be able to fetch daily schedule with customer and service details for a barberman", async () => {
    const today = new Date();

    const booking = Booking.create({
      barbershopId: new UniqueEntityId("shop-1"),
      barbermanId: new UniqueEntityId("barber-1"),
      shoppingCartId: new UniqueEntityId("cart-1"),
      date: today,
      startTime: "09:00",
      endTime: "09:30",
    });

    await inMemoryBookingsRepository.create(booking);

    const result = await sut.execute({
      barbermanId: "barber-1",
      date: today,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.bookings).toHaveLength(1);
      expect(result.value.bookings[0].customer.name).toEqual("John Doe");
      expect(result.value.bookings[0].services[0].title).toEqual(
        "Corte de Cabelo",
      );
    }
  });
});
