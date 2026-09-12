import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { BookingNotFoundError } from "../../_errors/booking-not-found-error";
import { CancelBookingUseCase } from "./cancel-booking";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: CancelBookingUseCase;

describe("Cancel Booking Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new CancelBookingUseCase(inMemoryBookingsRepository);
  });

  it("should be able to find and cancel a booking", async () => {
    const today = new Date();

    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: today,
        startTime: "09:00",
        endTime: "10:00",
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(booking);

    const result = await sut.execute({
      bookingId: "booking-1",
    });

    expect(result.isRight()).toBe(true);
  });

  it("should not be able to cancel a non-existing booking", async () => {
    const result = await sut.execute({
      bookingId: "non-existing-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingNotFoundError);
  });
});
