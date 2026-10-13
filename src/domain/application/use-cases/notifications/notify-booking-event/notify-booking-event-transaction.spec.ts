import { describe, expect, it, vi } from "vitest";
import { InMemoryNotificationsRepository } from "../../../../../../test/repositories/in-memory-notifications-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { NotifyBookingEventUseCase } from "./notify-booking-event";

function fixture(sameOwner = false) {
  const repo = new InMemoryNotificationsRepository();
  const shop = Barbershop.create(
    {
      name: "Test",
      ownerId: new UniqueEntityId(sameOwner ? "barber" : "owner"),
      timezone: "America/Sao_Paulo",
      slug: Slug.create("test"),
      cnpj: "12345678901234",
      location: "Test",
      status: "ACTIVE",
    },
    new UniqueEntityId("shop"),
  );
  const booking = Booking.create(
    {
      barbershopId: shop.id,
      barbermanId: new UniqueEntityId("barber"),
      customerId: new UniqueEntityId("client"),
      date: new Date("2035-11-15T00:00:00Z"),
      startTime: "11:00",
      endTime: "12:00",
    },
    new UniqueEntityId("booking"),
  );
  return { repo, shop, booking, sut: new NotifyBookingEventUseCase(repo) };
}

describe("Booking event transactional consolidation", () => {
  it("uses the caller transaction, canonical event and authoritative server time", async () => {
    const f = fixture(),
      tx = { marker: "tx" },
      now = new Date("2035-11-01T12:00:00Z");
    const save = vi.spyOn(f.repo, "createManyWithTx");
    await f.sut.execute({
      booking: f.booking,
      barbershop: f.shop,
      eventType: "UPDATED",
      tx,
      serverTime: now,
    } as any);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toBe(tx);
    const items = save.mock.calls[0][0];
    expect(items.map((n) => n.userId).sort()).toEqual([
      "barber",
      "client",
      "owner",
    ]);
    expect(
      items.every(
        (n) => n.type === "BOOKING_RESCHEDULED" && n.scheduledAt === now,
      ),
    ).toBe(true);
    expect(items.every((n) => n.eventId && n.referenceId === "booking")).toBe(
      true,
    );
  });
  it("keeps the civil date even when the unit is UTC-3", async () => {
    const f = fixture();
    await f.sut.execute({
      booking: f.booking,
      barbershop: f.shop,
      eventType: "UPDATED",
    });
    expect(f.repo.items.every((n) => n.message.includes("15/11/2035"))).toBe(
      true,
    );
  });
  it("deduplicates owner who is also the professional", async () => {
    const f = fixture(true);
    await f.sut.execute({
      booking: f.booking,
      barbershop: f.shop,
      eventType: "CANCELLED",
    });
    expect(f.repo.items.map((n) => n.userId.toString()).sort()).toEqual([
      "barber",
      "client",
    ]);
    expect(f.repo.items.every((n) => n.type === "BOOKING_CANCELLED")).toBe(
      true,
    );
  });
  it("notifies the previous professional when the booking is transferred", async () => {
    const f = fixture();
    await f.sut.execute({
      booking: f.booking,
      barbershop: f.shop,
      eventType: "UPDATED",
      previousBarbermanId: "previous",
    } as any);
    expect(f.repo.items.map((n) => n.userId.toString()).sort()).toEqual([
      "barber",
      "client",
      "owner",
      "previous",
    ]);
  });
  it("propagates notification failure so the caller transaction can roll back", async () => {
    const f = fixture();
    vi.spyOn(f.repo, "createManyWithTx").mockRejectedValue(
      new Error("notification failure"),
    );
    await expect(
      f.sut.execute({
        booking: f.booking,
        barbershop: f.shop,
        eventType: "UPDATED",
        tx: {},
      } as any),
    ).rejects.toThrow("notification failure");
  });
});
