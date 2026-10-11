import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  barbershops,
  services,
  bookings,
  bookingServiceItems,
  bookingEvents,
} from "./schema";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { DrizzleBookingItemsRepository } from "./repositories/drizzle-booking-items-repository";
import { Booking } from "../../domain/enterprise/entities/booking";
import { BookingServiceItem } from "../../domain/enterprise/entities/booking-service-item";
import { UniqueEntityId } from "../../core/entities/unique-entity-id";

describe("Booking Items & History Persistence (Task B1)", () => {
  let bookingsRepository: DrizzleBookingsRepository;
  let bookingItemsRepository: DrizzleBookingItemsRepository;

  // Static fixtures with valid UUIDs
  let customerId: string;
  let barbermanId: string;
  let ownerId: string;
  let barbershopId: string;
  let service1Id: string;
  let service2Id: string;

  const createdBookingIds: string[] = [];

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();

  beforeAll(async () => {
    bookingsRepository = new DrizzleBookingsRepository();
    bookingItemsRepository = new DrizzleBookingItemsRepository();

    // 1. Create test owner and shop
    ownerId = randomUUID();
    await db.insert(users).values({
      id: ownerId,
      name: "Owner Test",
      email: `owner_${ownerId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
    });

    barbershopId = randomUUID();
    await db.insert(barbershops).values({
      id: barbershopId,
      name: "Barbershop B1 Test",
      ownerId,
      slug: `barbershop-b1-${barbershopId.slice(0, 8)}`,
      cnpj: `${barbershopId.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}`,
      location: "Rua Teste, 123",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    // 2. Create customer and barberman
    customerId = randomUUID();
    await db.insert(users).values({
      id: customerId,
      name: "Customer B1",
      email: `customer_${customerId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      phoneNumber: "(11) 98765-4321",
    });

    barbermanId = randomUUID();
    await db.insert(users).values({
      id: barbermanId,
      name: "Barberman B1",
      email: `barber_${barbermanId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
    });

    // 3. Create two services in catalog
    service1Id = randomUUID();
    await db.insert(services).values({
      id: service1Id,
      barbershopId,
      title: "Corte Cabelo",
      priceInCents: 4000,
      durationInMinutes: 30,
      isActive: true,
    });

    service2Id = randomUUID();
    await db.insert(services).values({
      id: service2Id,
      barbershopId,
      title: "Barba Terapia",
      priceInCents: 3000,
      durationInMinutes: 20,
      isActive: true,
    });
  });

  afterAll(async () => {
    // Cleanup created test records in reverse order
    try {
      if (createdBookingIds.length > 0) {
        await db
          .delete(bookingEvents)
          .where(inArray(bookingEvents.bookingId, createdBookingIds));
        await db
          .delete(bookingServiceItems)
          .where(inArray(bookingServiceItems.bookingId, createdBookingIds));
        await db
          .delete(bookings)
          .where(inArray(bookings.id, createdBookingIds));
      }
      await db.delete(services).where(eq(services.barbershopId, barbershopId));
      await db.delete(barbershops).where(eq(barbershops.id, barbershopId));
      await db
        .delete(users)
        .where(inArray(users.id, [customerId, barbermanId, ownerId]));
    } catch {
      // Ignore cleanup error
    }
  });

  it("new_booking_retains_two_snapshots: persists and reloads two individual service snapshots and sums 7000/50", async () => {
    const bookingId = randomUUID();
    createdBookingIds.push(bookingId);

    const startsAt = new Date("2026-10-15T13:00:00.000Z");
    const endsAt = new Date("2026-10-15T13:50:00.000Z");

    const item1 = BookingServiceItem.create({
      bookingId: new UniqueEntityId(bookingId),
      serviceId: new UniqueEntityId(service1Id),
      title: "Corte Cabelo",
      priceInCents: 4000,
      durationInMinutes: 30,
      legacyAggregate: false,
    });

    const item2 = BookingServiceItem.create({
      bookingId: new UniqueEntityId(bookingId),
      serviceId: new UniqueEntityId(service2Id),
      title: "Barba Terapia",
      priceInCents: 3000,
      durationInMinutes: 20,
      legacyAggregate: false,
    });

    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        barbermanId: new UniqueEntityId(barbermanId),
        customerId: new UniqueEntityId(customerId),
        startsAt,
        endsAt,
        timezone: "America/Sao_Paulo",
        status: "CONFIRMED",
        version: 1,
        createdByUserId: new UniqueEntityId(customerId),
        clientRequestId: `req-${randomUUID()}`,
        date: startsAt,
        startTime: "10:00",
        endTime: "10:50",
      },
      new UniqueEntityId(bookingId),
    );

    // Act: persist atomically
    await bookingsRepository.createWithItems({
      booking,
      items: [item1, item2],
    });

    // Assert: reload details
    const saved = await bookingsRepository.getDetails(bookingId);
    expect(saved).not.toBeNull();
    expect(saved!.services).toHaveLength(2);
    expect(saved!.services.map((x) => x.serviceId)).toEqual([
      service1Id,
      service2Id,
    ]);
    expect(saved!.services[0].title).toBe("Corte Cabelo");
    expect(saved!.services[0].priceInCents).toBe(4000);
    expect(saved!.services[0].durationInMinutes).toBe(30);
    expect(saved!.services[0].legacyAggregate).toBe(false);

    expect(saved!.services[1].title).toBe("Barba Terapia");
    expect(saved!.services[1].priceInCents).toBe(3000);
    expect(saved!.services[1].durationInMinutes).toBe(20);
    expect(saved!.services[1].legacyAggregate).toBe(false);

    expect(saved!.totalPriceInCents).toBe(7000);
    expect(saved!.totalDurationInMinutes).toBe(50);
  });

  it("legacy_aggregate_is_not_split: aggregate remains marked without inventing IDs or splitting", async () => {
    const bookingId = randomUUID();
    createdBookingIds.push(bookingId);

    const startsAt = new Date("2026-10-15T14:00:00.000Z");
    const endsAt = new Date("2026-10-15T14:50:00.000Z");

    // Legacy aggregate has no faithful single service ID, title "A + B", legacyAggregate: true
    const legacyItem = BookingServiceItem.create({
      bookingId: new UniqueEntityId(bookingId),
      serviceId: null, // Unknown/unfaithful in legacy aggregate
      title: "Corte + Barba",
      priceInCents: 7000,
      durationInMinutes: 50,
      legacyAggregate: true,
    });

    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        barbermanId: new UniqueEntityId(barbermanId),
        customerId: new UniqueEntityId(customerId),
        startsAt,
        endsAt,
        timezone: "America/Sao_Paulo",
        status: "CONFIRMED",
        version: 1,
        createdByUserId: new UniqueEntityId(customerId),
        clientRequestId: `req-${randomUUID()}`,
        date: startsAt,
        startTime: "11:00",
        endTime: "11:50",
      },
      new UniqueEntityId(bookingId),
    );

    await bookingsRepository.createWithItems({
      booking,
      items: [legacyItem],
    });

    const legacy = await bookingsRepository.getDetails(bookingId);
    expect(legacy).not.toBeNull();
    expect(legacy!.services).toHaveLength(1);
    expect(legacy!.services[0].legacyAggregate).toBe(true);
    expect(legacy!.services[0].serviceId).toBeNull();
    expect(legacy!.services[0].title).toBe("Corte + Barba");
    expect(legacy!.services[0].priceInCents).toBe(7000);
    expect(legacy!.services[0].durationInMinutes).toBe(50);
    expect(legacy!.totalPriceInCents).toBe(7000);
    expect(legacy!.totalDurationInMinutes).toBe(50);
  });

  it("catalog_edit_does_not_rewrite_history: altering or deactivating catalog service does not alter persisted snapshot", async () => {
    const dynamicServiceId = randomUUID();
    await db.insert(services).values({
      id: dynamicServiceId,
      barbershopId,
      title: "Preço Original",
      priceInCents: 5000,
      durationInMinutes: 30,
      isActive: true,
    });

    const bookingId = randomUUID();
    createdBookingIds.push(bookingId);

    const item = BookingServiceItem.create({
      bookingId: new UniqueEntityId(bookingId),
      serviceId: new UniqueEntityId(dynamicServiceId),
      title: "Preço Original",
      priceInCents: 5000,
      durationInMinutes: 30,
      legacyAggregate: false,
    });

    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        barbermanId: new UniqueEntityId(barbermanId),
        customerId: new UniqueEntityId(customerId),
        startsAt: new Date("2026-10-15T15:00:00.000Z"),
        endsAt: new Date("2026-10-15T15:30:00.000Z"),
        timezone: "America/Sao_Paulo",
        status: "CONFIRMED",
        version: 1,
        createdByUserId: new UniqueEntityId(customerId),
        clientRequestId: `req-${randomUUID()}`,
        date: new Date("2026-10-15T15:00:00.000Z"),
        startTime: "12:00",
        endTime: "12:30",
      },
      new UniqueEntityId(bookingId),
    );

    await bookingsRepository.createWithItems({
      booking,
      items: [item],
    });

    // Mutate catalog service heavily
    await db
      .update(services)
      .set({
        title: "Preço Novo Absurdo",
        priceInCents: 99999,
        durationInMinutes: 120,
        isActive: false,
      })
      .where(eq(services.id, dynamicServiceId));

    // Reload booking details
    const saved = await bookingsRepository.getDetails(bookingId);
    expect(saved).not.toBeNull();
    expect(saved!.services[0].title).toBe("Preço Original");
    expect(saved!.services[0].priceInCents).toBe(5000);
    expect(saved!.services[0].durationInMinutes).toBe(30);
    expect(saved!.totalPriceInCents).toBe(5000);
    expect(saved!.totalDurationInMinutes).toBe(30);
  });

  it("failed_item_write_rolls_back_booking: failure in item write does not leave partial booking or items", async () => {
    const bookingId = randomUUID();
    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        barbermanId: new UniqueEntityId(barbermanId),
        customerId: new UniqueEntityId(customerId),
        startsAt: new Date("2026-10-15T16:00:00.000Z"),
        endsAt: new Date("2026-10-15T16:30:00.000Z"),
        timezone: "America/Sao_Paulo",
        status: "CONFIRMED",
        version: 1,
        createdByUserId: new UniqueEntityId(customerId),
        clientRequestId: `req-${randomUUID()}`,
        date: new Date("2026-10-15T16:00:00.000Z"),
        startTime: "13:00",
        endTime: "13:30",
      },
      new UniqueEntityId(bookingId),
    );

    // Create an item with invalid service foreign key to force DB constraint failure
    const nonExistentServiceId = randomUUID();
    const failingItem = BookingServiceItem.create({
      bookingId: new UniqueEntityId(bookingId),
      serviceId: new UniqueEntityId(nonExistentServiceId), // Violates foreign key
      title: "Failing Service",
      priceInCents: 5000,
      durationInMinutes: 30,
      legacyAggregate: false,
    });

    await expect(
      bookingsRepository.createWithItems({
        booking,
        items: [failingItem],
      }),
    ).rejects.toThrow();

    // Verify neither booking nor item exists in DB
    const foundBooking = await bookingsRepository.findById(bookingId);
    expect(foundBooking).toBeNull();

    const items = await bookingItemsRepository.findManyByBookingId(bookingId);
    expect(items).toHaveLength(0);
  });

  it("migration_preserves_legacy_counts_and_links: reading legacy bookings preserves references and links", async () => {
    // Query existing legacy bookings in database
    const existingBookings = await db.select().from(bookings).limit(5);
    expect(existingBookings.length).toBeGreaterThan(0);

    for (const legacyRow of existingBookings) {
      const details = await bookingsRepository.getDetails(legacyRow.id);
      expect(details).not.toBeNull();
      expect(details!.bookingId.toString()).toBe(legacyRow.id);
      expect(details!.barbershopId.toString()).toBe(legacyRow.barbershopId);
      expect(details!.barbermanId.toString()).toBe(legacyRow.barbermanId);
      expect(details!.services.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("unknown_values_and_status_not_faked: unknown status remains null, unknown prices do not become zero", async () => {
    const bookingId = randomUUID();
    createdBookingIds.push(bookingId);

    const item = BookingServiceItem.create({
      bookingId: new UniqueEntityId(bookingId),
      serviceId: null,
      title: "Atendimento Antigo Sem Preço",
      priceInCents: null,
      durationInMinutes: null,
      legacyAggregate: true,
    });

    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        barbermanId: new UniqueEntityId(barbermanId),
        customerId: new UniqueEntityId(customerId),
        startsAt: null,
        endsAt: null,
        timezone: "America/Sao_Paulo",
        status: null, // Legacy unknown status
        version: 1,
        createdByUserId: null,
        clientRequestId: null,
        date: new Date("2026-09-01T00:00:00.000Z"),
        startTime: "09:00",
        endTime: "09:30",
      },
      new UniqueEntityId(bookingId),
    );

    await bookingsRepository.createWithItems({
      booking,
      items: [item],
    });

    const saved = await bookingsRepository.getDetails(bookingId);
    expect(saved).not.toBeNull();
    expect(saved!.status).toBeNull(); // Must NOT fake as COMPLETED or NO_SHOW
    expect(saved!.services[0].priceInCents).toBeNull();
    expect(saved!.totalPriceInCents).toBeNull(); // Must NOT fake as 0
  });
});
