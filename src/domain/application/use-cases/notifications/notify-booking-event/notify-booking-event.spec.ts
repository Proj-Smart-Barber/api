import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryNotificationsRepository } from "../../../../../../test/repositories/in-memory-notifications-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { NotifyBookingEventUseCase } from "./notify-booking-event";

let inMemoryNotificationsRepository: InMemoryNotificationsRepository;
let sut: NotifyBookingEventUseCase;

describe("Notify Booking Event Use Case", () => {
  beforeEach(() => {
    inMemoryNotificationsRepository = new InMemoryNotificationsRepository();
    sut = new NotifyBookingEventUseCase(inMemoryNotificationsRepository);
  });

  it("should create batch notifications for barber and owner when booking is updated", async () => {
    const barbershop = Barbershop.create(
      {
        name: "Test Shop",
        ownerId: new UniqueEntityId("owner-1"),
        timezone: "UTC",
        slug: Slug.create("test-shop"),
        cnpj: "12345678901234",
        location: "Loc",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-1"),
    );

    const booking = Booking.create(
      {
        barbershopId: barbershop.id,
        barbermanId: new UniqueEntityId("barber-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
        date: new Date("2026-09-15"),
        startTime: "14:00",
        endTime: "14:30",
      },
      new UniqueEntityId("booking-1"),
    );

    await sut.execute({
      booking,
      barbershop,
      eventType: "UPDATED",
    });

    expect(inMemoryNotificationsRepository.items).toHaveLength(2);
    expect(inMemoryNotificationsRepository.items[0].type).toBe(
      "BOOKING_UPDATED",
    );
  });
});
