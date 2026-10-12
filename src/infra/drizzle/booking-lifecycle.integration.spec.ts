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
  bookingEvents,
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
import { CancelBookingUseCase } from "../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { RescheduleBookingUseCase } from "../../domain/application/use-cases/booking/reschedule-booking/reschedule-booking";
import { TransitionBookingStatusUseCase } from "../../domain/application/use-cases/booking/transition-booking-status/transition-booking-status";
import {
  ActionDeadlinePassedError,
  BookingVersionConflictError,
  QuoteChangedError,
  SlotUnavailableError,
} from "../../domain/application/use-cases/_errors/booking-errors";
import { NotAllowedError } from "../../domain/application/use-cases/_errors/not-allowed-error";
import { BookingPolicy } from "../../domain/application/services/booking-policy";

describe("Booking Lifecycle & Transitions (Task B4)", () => {
  let bookingsRepository: DrizzleBookingsRepository;
  let servicesRepository: DrizzleServicesRepository;
  let membershipsRepository: DrizzleMembershipsRepository;
  let usersRepository: DrizzleUsersRepository;
  let barbershopsRepository: DrizzleBarbershopsRepository;
  let notificationsRepository: DrizzleNotificationsRepository;
  let unitOfWork: DrizzleProfessionalMembershipUnitOfWork;

  let createBookingUseCase: CreateBookingUseCase;
  let cancelBookingUseCase: CancelBookingUseCase;
  let rescheduleBookingUseCase: RescheduleBookingUseCase;
  let transitionStatusUseCase: TransitionBookingStatusUseCase;

  const testUserIds: string[] = [];
  const testShopIds: string[] = [];
  const testServiceIds: string[] = [];
  const testBookingIds: string[] = [];

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();
  const randomCnpj = () =>
    Math.floor(10000000000000 + Math.random() * 90000000000000).toString();

  let ownerId: string;
  let barber1Id: string;
  let barber2Id: string;
  let customerId: string;
  let shopId: string;
  let service1Id: string;
  let service2Id: string;

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

    cancelBookingUseCase = new CancelBookingUseCase(
      bookingsRepository,
      membershipsRepository,
      notificationsRepository,
      unitOfWork,
    );

    rescheduleBookingUseCase = new RescheduleBookingUseCase(
      bookingsRepository,
      servicesRepository,
      membershipsRepository,
      notificationsRepository,
      unitOfWork,
    );

    transitionStatusUseCase = new TransitionBookingStatusUseCase(
      bookingsRepository,
      membershipsRepository,
      notificationsRepository,
      unitOfWork,
    );

    // 1. Create Users
    ownerId = randomUUID();
    barber1Id = randomUUID();
    barber2Id = randomUUID();
    customerId = randomUUID();
    testUserIds.push(ownerId, barber1Id, barber2Id, customerId);

    await db.insert(users).values([
      {
        id: ownerId,
        name: "Owner Lifecycle",
        email: `owner_${Date.now()}_${ownerId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
      {
        id: barber1Id,
        name: "Barber 1",
        email: `barber1_${Date.now()}_${barber1Id.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
      {
        id: barber2Id,
        name: "Barber 2",
        email: `barber2_${Date.now()}_${barber2Id.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
      {
        id: customerId,
        name: "Customer Lifecycle",
        email: `cust_${Date.now()}_${customerId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: randomCpf(),
        emailVerifiedAt: new Date(),
      },
    ]);

    // 2. Barbershop
    shopId = randomUUID();
    testShopIds.push(shopId);

    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Lifecycle",
      slug: `shop-life-${shopId.slice(0, 8)}`,
      cnpj: randomCnpj(),
      location: "Rua Lifecycle, 10",
      timezone: "America/Sao_Paulo",
      ownerId,
      status: "ACTIVE",
    });

    // 3. Memberships
    await db.insert(membership).values([
      {
        id: randomUUID(),
        userId: ownerId,
        barbershopId: shopId,
        role: "OWNER",
        state: "ACTIVE",
        version: 1,
      },
      {
        id: randomUUID(),
        userId: barber1Id,
        barbershopId: shopId,
        role: "BARBERMAN",
        state: "ACTIVE",
        version: 1,
      },
      {
        id: randomUUID(),
        userId: barber2Id,
        barbershopId: shopId,
        role: "BARBERMAN",
        state: "ACTIVE",
        version: 1,
      },
    ]);

    // 4. Services
    service1Id = randomUUID();
    service2Id = randomUUID();
    testServiceIds.push(service1Id, service2Id);

    await db.insert(services).values([
      {
        id: service1Id,
        barbershopId: shopId,
        title: "Corte Moderno",
        priceInCents: 4500,
        durationInMinutes: 30,
        isActive: true,
      },
      {
        id: service2Id,
        barbershopId: shopId,
        title: "Barba Terapia",
        priceInCents: 3500,
        durationInMinutes: 30,
        isActive: true,
      },
    ]);
  });

  afterAll(async () => {
    if (testBookingIds.length > 0) {
      await db
        .delete(bookingEvents)
        .where(inArray(bookingEvents.bookingId, testBookingIds));
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

  it("should logically cancel booking, increment version, persist event and notify without physical delete", async () => {
    const created = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId: barber1Id,
      serviceIds: [service1Id],
      date: "2026-11-25",
      startTime: "14:00",
    });
    expect(created.isRight()).toBe(true);
    const booking = created.value as any;
    testBookingIds.push(booking.booking.id.toString());

    // Cancel as customer
    const cancelRes = await cancelBookingUseCase.execute({
      bookingId: booking.booking.id.toString(),
      actorId: customerId,
      scope: "PERSONAL",
      reason: "Compromisso inadiável",
      expectedVersion: 1,
    });

    expect(cancelRes.isRight()).toBe(true);
    if (cancelRes.isRight()) {
      expect(cancelRes.value.booking.status).toBe("CANCELLED");
      expect(cancelRes.value.booking.version).toBe(2);
    }

    // Verify row still exists in DB (not physically deleted!)
    const [dbBooking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booking.booking.id.toString()));
    expect(dbBooking).toBeDefined();
    expect(dbBooking.status).toBe("CANCELLED");
    expect(dbBooking.version).toBe(2);

    // Verify items still exist
    const items = await db
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, booking.booking.id.toString()));
    expect(items.length).toBeGreaterThan(0);

    // Verify CANCELLED event
    const events = await db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, booking.booking.id.toString()));
    expect(
      events.some((e) => e.eventType === "CANCELLED" && e.newVersion === 2),
    ).toBe(true);

    // Verify notification sent to barber
    const barberNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, barber1Id));
    expect(
      barberNotifications.some(
        (n) => n.referenceId === booking.booking.id.toString(),
      ),
    ).toBe(true);
  });

  it("should enforce PERSONAL cancellation deadline (-2h inclusive limit)", async () => {
    // Booking starts at 2026-11-26 14:00:00 (America/Sao_Paulo is UTC-3 -> 17:00:00 UTC)
    const created = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId: barber1Id,
      serviceIds: [service1Id],
      date: "2026-11-26",
      startTime: "14:00",
    });
    expect(created.isRight()).toBe(true);
    const booking = (created.value as any).booking;
    testBookingIds.push(booking.id.toString());

    // 2h before is 12:00:00. If now is 12:00:01 (1h 59m 59s before), it must be rejected!
    const startsAt = booking.startsAt as Date;
    const lateServerTime = new Date(
      startsAt.getTime() - (2 * 60 * 60 * 1000 - 1000),
    ); // 1h59m59s before

    const customCancelUseCase = new CancelBookingUseCase(
      bookingsRepository,
      membershipsRepository,
      notificationsRepository,
      // no UoW so it uses internal logic without fetching clock_timestamp
    );

    // With booking policy directly
    const policyResult = BookingPolicy.canCancel({
      status: "CONFIRMED",
      startsAt,
      serverTime: lateServerTime,
      scope: "PERSONAL",
      actorId: customerId,
      customerId,
      barbermanId: barber1Id,
    });

    expect(policyResult.allowed).toBe(false);
    expect(policyResult.reasonCode).toBe("ACTION_DEADLINE_PASSED");

    // Exactly 2h before (allowed)
    const exactDeadline = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
    const exactPolicyResult = BookingPolicy.canCancel({
      status: "CONFIRMED",
      startsAt,
      serverTime: exactDeadline,
      scope: "PERSONAL",
      actorId: customerId,
      customerId,
      barbermanId: barber1Id,
    });
    expect(exactPolicyResult.allowed).toBe(true);
  });

  it("should reschedule booking atomically, update items, version and notify", async () => {
    const created = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId: barber1Id,
      serviceIds: [service1Id],
      date: "2026-11-27",
      startTime: "10:00",
    });
    expect(created.isRight()).toBe(true);
    const booking = (created.value as any).booking;
    testBookingIds.push(booking.id.toString());

    // Reschedule to 11:00 with service1 + service2 (price 4500 + 3500 = 8000)
    const res = await rescheduleBookingUseCase.execute({
      bookingId: booking.id.toString(),
      actorId: customerId,
      scope: "PERSONAL",
      date: "2026-11-27",
      startTime: "11:00",
      serviceIds: [service1Id, service2Id],
      expectedTotalPriceInCents: 8000,
      expectedDurationInMinutes: 60,
      expectedVersion: 1,
    });

    expect(res.isRight()).toBe(true);
    if (res.isRight()) {
      const updated = res.value.booking;
      expect(updated.version).toBe(2);
      expect(updated.startTime).toBe("11:00");
      expect(updated.endTime).toBe("12:00");
      expect(updated.totalPriceInCents).toBe(8000);
      expect(updated.totalDurationInMinutes).toBe(60);

      // Verify DB row
      const [dbRow] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking.id.toString()));
      expect(dbRow.version).toBe(2);
      expect(dbRow.startTime).toBe("11:00");
      expect(dbRow.endTime).toBe("12:00");

      // Verify updated items in DB
      const items = await db
        .select()
        .from(bookingServiceItems)
        .where(eq(bookingServiceItems.bookingId, booking.id.toString()));
      expect(items).toHaveLength(2);
      expect(items.some((i) => i.title === "Corte Moderno")).toBe(true);
      expect(items.some((i) => i.title === "Barba Terapia")).toBe(true);
    }
  });

  it("should rollback reschedule on slot conflict, preserving original booking completely", async () => {
    // 1. Booking A for Barber 1: 15:00 - 15:30
    const resA = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId: barber1Id,
      serviceIds: [service1Id],
      date: "2026-11-28",
      startTime: "15:00",
    });
    expect(resA.isRight()).toBe(true);
    const bookingA = (resA.value as any).booking;
    testBookingIds.push(bookingA.id.toString());

    // 2. Booking B for Barber 1: 16:00 - 16:30
    const resB = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId: barber1Id,
      serviceIds: [service1Id],
      date: "2026-11-28",
      startTime: "16:00",
    });
    expect(resB.isRight()).toBe(true);
    const bookingB = (resB.value as any).booking;
    testBookingIds.push(bookingB.id.toString());

    // 3. Try to reschedule Booking B to 15:00 (conflicts with Booking A)
    const conflictRes = await rescheduleBookingUseCase.execute({
      bookingId: bookingB.id.toString(),
      actorId: customerId,
      scope: "PERSONAL",
      date: "2026-11-28",
      startTime: "15:00",
      serviceIds: [service1Id],
      expectedVersion: 1,
    });

    expect(conflictRes.isLeft()).toBe(true);
    if (conflictRes.isLeft()) {
      expect(conflictRes.value).toBeInstanceOf(SlotUnavailableError);
    }

    // 4. Verify Booking B remains unchanged
    const [dbB] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingB.id.toString()));
    expect(dbB.startTime).toBe("16:00");
    expect(dbB.version).toBe(1);
    expect(dbB.status).toBe("CONFIRMED");
  });

  it("should enforce status transition restrictions: COMPLETED only >= startsAt, NO_SHOW only >= startsAt + 15m", async () => {
    const created = await createBookingUseCase.execute({
      actorId: customerId,
      scope: "PERSONAL",
      barbermanId: barber1Id,
      serviceIds: [service1Id],
      date: "2026-11-29",
      startTime: "10:00",
    });
    expect(created.isRight()).toBe(true);
    const booking = (created.value as any).booking;
    testBookingIds.push(booking.id.toString());

    // Booking startsAt is 2026-11-29 13:00 UTC (10:00 SP time)
    // Server time right now is 2026-10-12 (well before startsAt)
    // Attempt to mark COMPLETED before startsAt
    const completeRes = await transitionStatusUseCase.execute({
      bookingId: booking.id.toString(),
      actorId: barber1Id,
      status: "COMPLETED",
    });
    expect(completeRes.isLeft()).toBe(true);
    if (completeRes.isLeft()) {
      expect(completeRes.value).toBeInstanceOf(ActionDeadlinePassedError);
      expect(completeRes.value.message).toContain("NOT_YET_STARTED");
    }

    // Attempt to mark NO_SHOW before startsAt + 15m
    const noShowRes = await transitionStatusUseCase.execute({
      bookingId: booking.id.toString(),
      actorId: barber1Id,
      status: "NO_SHOW",
    });
    expect(noShowRes.isLeft()).toBe(true);
    if (noShowRes.isLeft()) {
      expect(noShowRes.value).toBeInstanceOf(ActionDeadlinePassedError);
      expect(noShowRes.value.message).toContain("THRESHOLD_NOT_REACHED");
    }

    // Test policy directly at exact 15m mark
    const startsAt = booking.startsAt as Date;

    // 14m 59s: not allowed
    const beforeGrace = new Date(startsAt.getTime() + (15 * 60 * 1000 - 1000));
    expect(
      BookingPolicy.canMarkNoShow({
        status: "CONFIRMED",
        startsAt,
        serverTime: beforeGrace,
        barbermanId: barber1Id,
      }).allowed,
    ).toBe(false);

    // 15m 00s: allowed!
    const exactGrace = new Date(startsAt.getTime() + 15 * 60 * 1000);
    expect(
      BookingPolicy.canMarkNoShow({
        status: "CONFIRMED",
        startsAt,
        serverTime: exactGrace,
        barbermanId: barber1Id,
      }).allowed,
    ).toBe(true);
  });
});
