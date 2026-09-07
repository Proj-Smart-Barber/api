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

  it("deve ser possível encontrar e cancelar um agendamento", async () => {
    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(booking);

    const result = await sut.execute({
      bookingId: "booking-1",
    });

    expect(result.isRight()).toBe(true);
  });

  it("não deve ser possível cancelar um agendamento inexistente", async () => {
    const result = await sut.execute({
      bookingId: "non-existing-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingNotFoundError);
  });
});
