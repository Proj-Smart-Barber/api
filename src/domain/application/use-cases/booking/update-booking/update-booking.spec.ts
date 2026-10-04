import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { UpdateBookingUseCase } from "./update-booking";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import { BookingConflictError } from "../../_errors/booking-conflict-error";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: UpdateBookingUseCase;

describe("Update Booking Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new UpdateBookingUseCase(inMemoryBookingsRepository);
  });

  it("should be able to update booking time", async () => {
    const bookingDate = new Date("2026-09-15T00:00:00.000Z");
    const newBooking = Booking.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: bookingDate,
        startTime: "14:00",
        endTime: "14:30",
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(newBooking);

    const result = await sut.execute({
      bookingId: "booking-1",
      barbermanId: "barberman-1",
      startTime: "15:00",
      endTime: "15:30",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.booking.startTime).toBe("15:00");
      expect(result.value.booking.endTime).toBe("15:30");
    }
  });

  it("should not be able to update a booking from another barberman", async () => {
    const newBooking = Booking.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: new Date(),
        startTime: "14:00",
        endTime: "14:30",
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(newBooking);

    const result = await sut.execute({
      bookingId: "booking-1",
      barbermanId: "other-barberman",
      startTime: "15:00",
      endTime: "15:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(UnauthorizedError);
  });

  it("should not be able to update a non-existing booking", async () => {
    const result = await sut.execute({
      bookingId: "non-existing",
      barbermanId: "barberman-1",
      startTime: "15:00",
      endTime: "15:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update booking if there is a time conflict", async () => {
    const bookingDate = new Date("2026-09-15T00:00:00.000Z");
    const booking1 = Booking.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: bookingDate,
        startTime: "14:00",
        endTime: "14:30",
      },
      new UniqueEntityId("booking-1"),
    );

    const booking2 = Booking.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-2"),
        date: bookingDate,
        startTime: "15:00",
        endTime: "15:30",
      },
      new UniqueEntityId("booking-2"),
    );

    await inMemoryBookingsRepository.create(booking1);
    await inMemoryBookingsRepository.create(booking2);

    // Try to update booking1 to conflict with booking2 (15:00 - 15:30)
    const result = await sut.execute({
      bookingId: "booking-1",
      barbermanId: "barberman-1",
      startTime: "15:00",
      endTime: "15:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingConflictError);
  });
});
