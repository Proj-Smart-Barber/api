import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryNotificationsRepository } from "../../../../../../test/repositories/in-memory-notifications-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UpdateBookingUseCase } from "./update-booking";
import { NotifyBookingEventUseCase } from "../../notifications/notify-booking-event/notify-booking-event";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { UnauthorizedError } from "../../_errors/unauthorized-error";
import { BookingConflictError } from "../../_errors/booking-conflict-error";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryNotificationsRepository: InMemoryNotificationsRepository;
let notifyBookingEventUseCase: NotifyBookingEventUseCase;
let sut: UpdateBookingUseCase;

describe("Update Booking Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryNotificationsRepository = new InMemoryNotificationsRepository();
    notifyBookingEventUseCase = new NotifyBookingEventUseCase(
      inMemoryNotificationsRepository,
    );
    sut = new UpdateBookingUseCase(
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

  it("should be able to update booking time and create notifications", async () => {
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
      expect(inMemoryNotificationsRepository.items.length).toBeGreaterThan(0);
      expect(inMemoryNotificationsRepository.items[0].type).toBe(
        "BOOKING_UPDATED",
      );
    }
  });

  it("should be able to update booking time as the barbershop owner", async () => {
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
      barbermanId: "owner-1",
      startTime: "16:00",
      endTime: "16:30",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.booking.startTime).toBe("16:00");
      expect(result.value.booking.endTime).toBe("16:30");
    }
  });

  it("should not be able to update a booking from another unauthorized user", async () => {
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
      barbermanId: "unauthorized-user",
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
