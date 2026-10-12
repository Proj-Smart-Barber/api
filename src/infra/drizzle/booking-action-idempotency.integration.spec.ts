import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  barbershops,
  membership,
  services,
  bookings,
  bookingServiceItems,
  bookingEvents,
  notifications,
  operationAttempts,
} from "./schema";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { DrizzleOperationAttemptsRepository } from "./repositories/drizzle-operation-attempts-repository";
import { DrizzleServicesRepository } from "./repositories/drizzle-services-repository";
import { DrizzleMembershipsRepository } from "./repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "./repositories/drizzle-notifications-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "./services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "./services/drizzle-resource-access-validator";
import {
  OperationAttemptService,
  IdempotencyKeyError,
} from "../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../domain/application/services/canonical-operation-hash";
import { CancelBookingUseCase } from "../../domain/application/use-cases/booking/cancel-booking/cancel-booking";
import { RescheduleBookingUseCase } from "../../domain/application/use-cases/booking/reschedule-booking/reschedule-booking";
import { TransitionBookingStatusUseCase } from "../../domain/application/use-cases/booking/transition-booking-status/transition-booking-status";
import { CreateBookingUseCase } from "../../domain/application/use-cases/booking/create-booking/create-booking";
import { DrizzleBarbershopsRepository } from "./repositories/drizzle-barbershops-repository";
import { DrizzleUsersRepository } from "./repositories/drizzle-users-repository";
import { generateUuidV7 } from "../../core/security/uuidv7";

function generateValidCpf(): string {
  const digits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 9),
  ).join("");
  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += Number(digits[i]) * (10 - i);
  const rem1 = (sum1 * 10) % 11;
  const d1 = rem1 === 10 ? 0 : rem1;

  const base10 = digits + d1;
  let sum2 = 0;
  for (let i = 0; i < 10; i++) sum2 += Number(base10[i]) * (11 - i);
  const rem2 = (sum2 * 10) % 11;
  const d2 = rem2 === 10 ? 0 : rem2;

  return `${digits}${d1}${d2}`;
}

describe("Booking Action Idempotency & Unified Ledger Integration (Task I2)", () => {
  let attemptsRepository: DrizzleOperationAttemptsRepository;
  let unitOfWork: DrizzleProfessionalMembershipUnitOfWork;
  let attemptService: OperationAttemptService;
  let bookingsRepository: DrizzleBookingsRepository;
  let servicesRepository: DrizzleServicesRepository;
  let membershipsRepository: DrizzleMembershipsRepository;
  let notificationsRepository: DrizzleNotificationsRepository;

  let cancelUseCase: CancelBookingUseCase;
  let rescheduleUseCase: RescheduleBookingUseCase;
  let transitionUseCase: TransitionBookingStatusUseCase;
  let createUseCase: CreateBookingUseCase;

  let ownerUserId: string;
  let barberUserId: string;
  let customerUserId: string;
  let shopId: string;
  let serviceId: string;

  beforeAll(async () => {
    attemptsRepository = new DrizzleOperationAttemptsRepository();
    unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
    bookingsRepository = new DrizzleBookingsRepository();
    servicesRepository = new DrizzleServicesRepository();
    membershipsRepository = new DrizzleMembershipsRepository();
    notificationsRepository = new DrizzleNotificationsRepository();
    const accessValidator = new DrizzleResourceAccessValidator();

    attemptService = new OperationAttemptService(
      attemptsRepository,
      unitOfWork,
      accessValidator,
    );

    cancelUseCase = new CancelBookingUseCase(
      bookingsRepository,
      membershipsRepository,
      notificationsRepository,
      unitOfWork,
    );

    rescheduleUseCase = new RescheduleBookingUseCase(
      bookingsRepository,
      servicesRepository,
      membershipsRepository,
      notificationsRepository,
      unitOfWork,
    );

    transitionUseCase = new TransitionBookingStatusUseCase(
      bookingsRepository,
      membershipsRepository,
      notificationsRepository,
      unitOfWork,
    );

    const barbershopsRepository = new DrizzleBarbershopsRepository();
    const usersRepository = new DrizzleUsersRepository();
    createUseCase = new CreateBookingUseCase(
      bookingsRepository,
      servicesRepository,
      membershipsRepository,
      usersRepository,
      barbershopsRepository,
      notificationsRepository,
      unitOfWork,
    );

    ownerUserId = randomUUID();
    barberUserId = randomUUID();
    customerUserId = randomUUID();

    await db.insert(users).values([
      {
        id: ownerUserId,
        name: "Ledger Owner",
        email: `owner_${ownerUserId.slice(0, 6)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "OWNER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: barberUserId,
        name: "Ledger Barber",
        email: `barber_${barberUserId.slice(0, 6)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "BARBER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: customerUserId,
        name: "Ledger Customer",
        email: `cust_${customerUserId.slice(0, 6)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "CLIENT",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
    ]);

    shopId = randomUUID();
    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Ledger Idempotency",
      slug: `shop-ledger-${shopId.slice(0, 8)}`,
      cnpj: `${shopId.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}`,
      location: "Rua Ledger, 500",
      timezone: "America/Sao_Paulo",
      ownerId: ownerUserId,
      status: "ACTIVE",
    });

    await db.insert(membership).values([
      {
        id: randomUUID(),
        userId: ownerUserId,
        barbershopId: shopId,
        role: "OWNER",
        state: "ACTIVE",
        version: 1,
      },
      {
        id: randomUUID(),
        userId: barberUserId,
        barbershopId: shopId,
        role: "BARBERMAN",
        state: "ACTIVE",
        version: 1,
      },
    ]);

    serviceId = randomUUID();
    await db.insert(services).values({
      id: serviceId,
      barbershopId: shopId,
      title: "Corte Idempotente",
      priceInCents: 4500,
      durationInMinutes: 30,
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await db
        .delete(operationAttempts)
        .where(eq(operationAttempts.actorId, customerUserId));
      await db
        .delete(operationAttempts)
        .where(eq(operationAttempts.actorId, barberUserId));
      await db.delete(services).where(eq(services.barbershopId, shopId));
      await db.delete(membership).where(eq(membership.barbershopId, shopId));
      await db.delete(barbershops).where(eq(barbershops.id, shopId));
      await db.delete(users).where(eq(users.id, ownerUserId));
      await db.delete(users).where(eq(users.id, barberUserId));
      await db.delete(users).where(eq(users.id, customerUserId));
    } catch {
      // ignore
    }
  });

  async function createBooking(date: string, startTime: string) {
    const res = await createUseCase.execute({
      actorId: customerUserId,
      scope: "PERSONAL",
      shopId,
      serviceIds: [serviceId],
      barbermanId: barberUserId,
      date,
      startTime,
    });
    if (res.isLeft()) throw res.value;
    return res.value.booking;
  }

  it("should execute CANCEL_BOOKING once, record exactly 1 event and replay safely", async () => {
    const booking = await createBooking("2026-11-01", "10:00");
    const requestId = generateUuidV7();

    const payloadHash = canonicalOperationHash({
      action: "CANCEL_BOOKING",
      bookingId: booking.id.toString(),
      expectedVersion: booking.version,
      reason: "Cancelamento teste",
      scope: "PERSONAL",
    });

    const lockResources = {
      unitIds: [shopId],
      professionalIds: [barberUserId],
      bookingIds: [booking.id.toString()],
    };

    // 1ª execução
    const result1 = await attemptService.executeOnce(
      {
        actorId: customerUserId,
        operation: "CANCEL_BOOKING",
        requestId,
        payloadHash,
        resourceKind: "BOOKING",
        lockResources,
      },
      async (tx, { serverTime }) => {
        const cancelResult = await cancelUseCase.execute({
          bookingId: booking.id.toString(),
          actorId: customerUserId,
          expectedVersion: booking.version,
          reason: "Cancelamento teste",
          scope: "PERSONAL",
          tx,
          serverTime,
        } as any);

        if (cancelResult.isLeft()) throw cancelResult.value;

        return {
          resourceKind: "BOOKING" as const,
          resourceId: booking.id.toString(),
          resourceVersion: cancelResult.value.booking.version,
          data: {
            id: booking.id.toString(),
            status: cancelResult.value.booking.status,
            version: cancelResult.value.booking.version,
          },
        };
      },
    );

    expect(result1.state).toBe("APPLIED");
    expect((result1.resource?.data as any)?.status).toBe("CANCELLED");

    // 2ª execução com mesma requestId e mesmo payloadHash (replay)
    const result2 = await attemptService.executeOnce(
      {
        actorId: customerUserId,
        operation: "CANCEL_BOOKING",
        requestId,
        payloadHash,
        resourceKind: "BOOKING",
        lockResources,
      },
      async () => {
        throw new Error("Command should not be invoked on replay");
      },
    );

    expect(result2.state).toBe("APPLIED");
    expect((result2.resource?.data as any)?.id).toBe(booking.id.toString());
    expect((result2.resource?.data as any)?.status).toBe("CANCELLED");

    // Verificar se existe exatamente 1 evento CANCELLED no banco
    const events = await db
      .select()
      .from(bookingEvents)
      .where(
        and(
          eq(bookingEvents.bookingId, booking.id.toString()),
          eq(bookingEvents.eventType, "CANCELLED"),
        ),
      );

    expect(events.length).toBe(1);
  });

  it("should reject replay if payloadHash differs with same requestId", async () => {
    const booking = await createBooking("2026-11-02", "11:00");
    const requestId = generateUuidV7();

    const payloadHashA = canonicalOperationHash({
      action: "CANCEL_BOOKING",
      bookingId: booking.id.toString(),
      reason: "Razao A",
    });

    const payloadHashB = canonicalOperationHash({
      action: "CANCEL_BOOKING",
      bookingId: booking.id.toString(),
      reason: "Razao B DIFERENTE",
    });

    await attemptService.executeOnce(
      {
        actorId: customerUserId,
        operation: "CANCEL_BOOKING",
        requestId,
        payloadHash: payloadHashA,
        resourceKind: "BOOKING",
      },
      async () => ({
        resourceKind: "BOOKING",
        resourceId: booking.id.toString(),
        resourceVersion: booking.version + 1,
        data: { ok: true },
      }),
    );

    await expect(
      attemptService.executeOnce(
        {
          actorId: customerUserId,
          operation: "CANCEL_BOOKING",
          requestId,
          payloadHash: payloadHashB,
          resourceKind: "BOOKING",
        },
        async () => ({
          resourceKind: "BOOKING",
        }),
      ),
    ).rejects.toThrow(IdempotencyKeyError);
  });
});
