import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  barbershops,
  membership,
  bookings,
  services,
  bookingServiceItems,
  notifications,
} from "./schema";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { DrizzleServicesRepository } from "./repositories/drizzle-services-repository";
import { DrizzleMembershipsRepository } from "./repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "./repositories/drizzle-users-repository";
import { DrizzleBarbershopsRepository } from "./repositories/drizzle-barbershops-repository";
import { DrizzleNotificationsRepository } from "./repositories/drizzle-notifications-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "./services/drizzle-professional-membership-unit-of-work";
import { CreateBookingUseCase } from "../../domain/application/use-cases/booking/create-booking/create-booking";
import {
  QuoteChangedError,
  SlotUnavailableError,
} from "../../domain/application/use-cases/_errors/booking-errors";
import { NotAllowedError } from "../../domain/application/use-cases/_errors/not-allowed-error";

describe("Booking Conflicts & Availability (Task B3)", () => {
  let bookingsRepository: DrizzleBookingsRepository;
  let servicesRepository: DrizzleServicesRepository;
  let membershipsRepository: DrizzleMembershipsRepository;
  let usersRepository: DrizzleUsersRepository;
  let barbershopsRepository: DrizzleBarbershopsRepository;
  let notificationsRepository: DrizzleNotificationsRepository;
  let unitOfWork: DrizzleProfessionalMembershipUnitOfWork;
  let createBookingUseCase: CreateBookingUseCase;

  const testUserIds: string[] = [];
  const testShopIds: string[] = [];
  const testServiceIds: string[] = [];
  const testBookingIds: string[] = [];

  let ownerId: string;
  let barbermanId: string;
  let customerId: string;
  let shopAId: string;
  let shopBId: string;
  let serviceA1Id: string;
  let serviceA2Id: string;
  let serviceB1Id: string;

  beforeAll(async () => {
    bookingsRepository = new DrizzleBookingsRepository();
    servicesRepository = new DrizzleServicesRepository();
    membershipsRepository = new DrizzleMembershipsRepository();
    usersRepository = new DrizzleUsersRepository();
    barbershopsRepository = new DrizzleBarbershopsRepository();
    notificationsRepository = new DrizzleNotificationsRepository();
    unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();

    createBookingUseCase = new CreateBookingUseCase(
      bookingsRepository,
      servicesRepository,
      membershipsRepository,
      usersRepository,
      barbershopsRepository,
      notificationsRepository,
      unitOfWork,
    );

    const randomCpf = () =>
      Math.floor(10000000000 + Math.random() * 90000000000).toString();
    const randomCnpj = () =>
      Math.floor(10000000000000 + Math.random() * 90000000000000).toString();

    // 1. Create Users
    ownerId = randomUUID();
    barbermanId = randomUUID();
    customerId = randomUUID();
    testUserIds.push(ownerId, barbermanId, customerId);

    await db.insert(users).values([
      {
        id: ownerId,
        name: "Owner Test",
        email: `owner_${Date.now()}_${ownerId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
      {
        id: barbermanId,
        name: "Barberman Test",
        email: `barber_${Date.now()}_${barbermanId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
      {
        id: customerId,
        name: "Customer Test",
        email: `customer_${Date.now()}_${customerId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
    ]);

    // 2. Create Barbershops
    shopAId = randomUUID();
    shopBId = randomUUID();
    testShopIds.push(shopAId, shopBId);

    await db.insert(barbershops).values([
      {
        id: shopAId,
        name: "Barbearia Unit A",
        slug: `shop-a-${shopAId.slice(0, 8)}`,
        cnpj: randomCnpj(),
        location: "Rua A, 100",
        timezone: "America/Sao_Paulo",
        ownerId,
        status: "ACTIVE",
      },
      {
        id: shopBId,
        name: "Barbearia Unit B",
        slug: `shop-b-${shopBId.slice(0, 8)}`,
        cnpj: randomCnpj(),
        location: "Rua B, 200",
        timezone: "America/Sao_Paulo",
        ownerId,
        status: "ACTIVE",
      },
    ]);

    // 3. Create Memberships
    await db.insert(membership).values([
      {
        id: randomUUID(),
        userId: ownerId,
        barbershopId: shopAId,
        role: "OWNER",
        state: "ACTIVE",
        version: 1,
      },
      {
        id: randomUUID(),
        userId: ownerId,
        barbershopId: shopBId,
        role: "OWNER",
        state: "ACTIVE",
        version: 1,
      },
      {
        id: randomUUID(),
        userId: barbermanId,
        barbershopId: shopAId,
        role: "BARBERMAN",
        state: "ACTIVE",
        version: 1,
      },
      {
        id: randomUUID(),
        userId: barbermanId,
        barbershopId: shopBId,
        role: "BARBERMAN",
        state: "ACTIVE",
        version: 1,
      },
    ]);

    // 4. Create Services
    serviceA1Id = randomUUID();
    serviceA2Id = randomUUID();
    serviceB1Id = randomUUID();
    testServiceIds.push(serviceA1Id, serviceA2Id, serviceB1Id);

    await db.insert(services).values([
      {
        id: serviceA1Id,
        barbershopId: shopAId,
        title: "Corte Cabelo A",
        priceInCents: 4000,
        durationInMinutes: 30,
        isActive: true,
      },
      {
        id: serviceA2Id,
        barbershopId: shopAId,
        title: "Barba A",
        priceInCents: 3000,
        durationInMinutes: 20,
        isActive: true,
      },
      {
        id: serviceB1Id,
        barbershopId: shopBId,
        title: "Corte Cabelo B",
        priceInCents: 5000,
        durationInMinutes: 30,
        isActive: true,
      },
    ]);
  });

  afterAll(async () => {
    if (testBookingIds.length > 0) {
      await db
        .delete(bookingServiceItems)
        .where(inArray(bookingServiceItems.bookingId, testBookingIds));
      await db.delete(bookings).where(inArray(bookings.id, testBookingIds));
    }
    if (testServiceIds.length > 0) {
      await db.delete(services).where(inArray(services.id, testServiceIds));
    }
    if (testShopIds.length > 0) {
      await db
        .delete(membership)
        .where(inArray(membership.barbershopId, testShopIds));
      await db.delete(barbershops).where(inArray(barbershops.id, testShopIds));
    }
    if (testUserIds.length > 0) {
      await db
        .delete(notifications)
        .where(inArray(notifications.userId, testUserIds));
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
  });

  it("should create booking with multiple services, sum prices/durations and persist individual snapshots", async () => {
    const result = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId,
      serviceIds: [serviceA1Id, serviceA2Id],
      date: "2026-11-20",
      startTime: "10:00",
      expectedTotalPriceInCents: 7000,
      expectedDurationInMinutes: 50,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      const { booking } = result.value;
      testBookingIds.push(booking.id.toString());

      expect(booking.totalPriceInCents).toBe(7000);
      expect(booking.totalDurationInMinutes).toBe(50);
      expect(booking.endTime).toBe("10:50");

      const items = await db
        .select()
        .from(bookingServiceItems)
        .where(eq(bookingServiceItems.bookingId, booking.id.toString()));

      expect(items).toHaveLength(2);
      expect(
        items.some(
          (i) => i.title === "Corte Cabelo A" && i.priceInCents === 4000,
        ),
      ).toBe(true);
      expect(
        items.some((i) => i.title === "Barba A" && i.priceInCents === 3000),
      ).toBe(true);
    }
  });

  it("should detect cross-unit conflict when barber is booked in shop A and client tries to book in shop B for overlapping slot", async () => {
    // 1. Create first booking in Shop A from 14:00 to 14:30
    const firstResult = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId,
      serviceIds: [serviceA1Id],
      date: "2026-11-21",
      startTime: "14:00",
    });

    expect(firstResult.isRight()).toBe(true);
    if (firstResult.isRight()) {
      testBookingIds.push(firstResult.value.booking.id.toString());
    }

    // 2. Try to book in Shop B from 14:15 to 14:45 (overlapping with 14:00-14:30)
    const conflictResult = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId,
      serviceIds: [serviceB1Id],
      date: "2026-11-21",
      startTime: "14:15",
    });

    expect(conflictResult.isLeft()).toBe(true);
    if (conflictResult.isLeft()) {
      expect(conflictResult.value).toBeInstanceOf(SlotUnavailableError);
    }
  });

  it("should reject booking and return QuoteChangedError when expectedTotalPriceInCents does not match authoritative sum", async () => {
    const result = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId,
      serviceIds: [serviceA1Id, serviceA2Id],
      date: "2026-11-22",
      startTime: "11:00",
      expectedTotalPriceInCents: 5000, // Client sent 5000, but real is 7000
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(QuoteChangedError);
      const quoteError = result.value as QuoteChangedError;
      expect(quoteError.quote.totalPriceInCents).toBe(7000);
      expect(quoteError.quote.totalDurationInMinutes).toBe(50);
      expect(quoteError.quote.serviceItems).toHaveLength(2);
    }
  });

  it("should reject services from different shops in single booking", async () => {
    const result = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId,
      serviceIds: [serviceA1Id, serviceB1Id], // Shop A + Shop B
      date: "2026-11-23",
      startTime: "09:00",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain("mesma barbearia");
    }
  });

  it("should reject past slots", async () => {
    const result = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId,
      serviceIds: [serviceA1Id],
      date: "2020-01-01",
      startTime: "10:00",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(SlotUnavailableError);
    }
  });
});
