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
  const today = new Date();
  it("should be able to cancel a booking", async () => {
    const newBooking = Booking.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: today,
        startTime: "14:00",
        endTime: "14:30",
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(newBooking);

    const result = await sut.execute({
      bookingId: "booking-1",
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryBookingsRepository.items).toHaveLength(1);
    expect(inMemoryBookingsRepository.items[0].id.toString()).toBe("booking-1");
  });

  it("should not be able to cancel a non-existing booking", async () => {
    const result = await sut.execute({
      bookingId: "non-existing-booking-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingNotFoundError);
  });
});
