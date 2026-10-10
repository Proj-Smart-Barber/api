import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryNotificationsRepository } from "../../../../../../test/repositories/in-memory-notifications-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { CancelBookingUseCase } from "./cancel-booking";
import { NotifyBookingEventUseCase } from "../../notifications/notify-booking-event/notify-booking-event";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryNotificationsRepository: InMemoryNotificationsRepository;
let notifyBookingEventUseCase: NotifyBookingEventUseCase;
let sut: CancelBookingUseCase;

describe("Cancel Booking Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryNotificationsRepository = new InMemoryNotificationsRepository();
    notifyBookingEventUseCase = new NotifyBookingEventUseCase(
      inMemoryNotificationsRepository,
    );
    sut = new CancelBookingUseCase(
      inMemoryBookingsRepository,
      inMemoryBarbershopsRepository,
      notifyBookingEventUseCase,
    );

    inMemoryBarbershopsRepository.items.push(
      Barbershop.create(
        {
          name: "Test Barbershop",
          ownerId: new UniqueEntityId("owner-1"),
          timezone: "UTC",
          slug: Slug.create("test-barbershop"),
          cnpj: "12345678901234",
          location: "Location",
          status: "ACTIVE",
        },
        new UniqueEntityId("barbershop-1"),
      ),
    );
  });

  it("should be able to cancel a booking and create notifications", async () => {
    const newBooking = Booking.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        barbermanId: new UniqueEntityId("barberman-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: new Date("2026-09-15"),
        startTime: "14:00",
        endTime: "14:30",
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(newBooking);

    const result = await sut.execute({
      bookingId: "booking-1",
      barbermanId: "barberman-1",
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryBookingsRepository.items).toHaveLength(0);
    expect(inMemoryNotificationsRepository.items.length).toBeGreaterThan(0);
    expect(inMemoryNotificationsRepository.items[0].type).toBe(
      "BOOKING_CANCELLED",
    );
  });

  it("should not be able to cancel a booking from another barberman", async () => {
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
      barbermanId: "another-barberman-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(UnauthorizedError);
  });

  it("should not be able to cancel a non-existing booking", async () => {
    const result = await sut.execute({
      bookingId: "non-existing-booking-id",
      barbermanId: "another-barberman-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
