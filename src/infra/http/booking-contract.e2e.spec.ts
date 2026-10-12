import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { inArray } from "drizzle-orm";
import { sign } from "jsonwebtoken";
import { generateUuidV7 } from "../../core/security/uuidv7";
import app from "../../app";
import { env } from "../env";
import { db } from "../drizzle";
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
} from "../drizzle/schema";

function generateValidCpf(): string {
  const digits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 9),
  ).join("");
  const factor1 = 10;
  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += Number(digits[i]) * (factor1 - i);
  const rem1 = (sum1 * 10) % 11;
  const d1 = rem1 === 10 ? 0 : rem1;

  const base10 = digits + d1;
  const factor2 = 11;
  let sum2 = 0;
  for (let i = 0; i < 10; i++) sum2 += Number(base10[i]) * (factor2 - i);
  const rem2 = (sum2 * 10) % 11;
  const d2 = rem2 === 10 ? 0 : rem2;

  return `${digits}${d1}${d2}`;
}

describe("Booking Contract & Lifecycle E2E Workflow (Task B5)", () => {
  let server: http.Server;
  let baseUrl: string;

  const randomCnpj = () =>
    Math.floor(10000000000000 + Math.random() * 90000000000000).toString();

  const testUserIds: string[] = [];
  const testShopIds: string[] = [];
  const testServiceIds: string[] = [];
  const testBookingIds: string[] = [];

  let ownerUserId: string;
  let barberUserId: string;
  let customerUserId: string;

  let ownerToken: string;
  let barberToken: string;
  let customerToken: string;

  let shopId: string;
  let service1Id: string;
  let service2Id: string;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // 1. Create Users
    ownerUserId = randomUUID();
    barberUserId = randomUUID();
    customerUserId = randomUUID();
    testUserIds.push(ownerUserId, barberUserId, customerUserId);

    await db.insert(users).values([
      {
        id: ownerUserId,
        name: "Contract Owner",
        email: `owner_${Date.now()}_${ownerUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "OWNER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: barberUserId,
        name: "Contract Barber",
        email: `barber_${Date.now()}_${barberUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "BARBER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: customerUserId,
        name: "Contract Customer",
        email: `cust_${Date.now()}_${customerUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "CLIENT",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
    ]);

    // 2. Barbershop
    shopId = randomUUID();
    testShopIds.push(shopId);

    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Contract E2E",
      slug: `shop-contract-${shopId.slice(0, 8)}`,
      cnpj: randomCnpj(),
      location: "Rua Contratos, 1",
      timezone: "America/Sao_Paulo",
      ownerId: ownerUserId,
      status: "ACTIVE",
    });

    // 3. Memberships
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

    // 4. Services
    service1Id = randomUUID();
    service2Id = randomUUID();
    testServiceIds.push(service1Id, service2Id);

    await db.insert(services).values([
      {
        id: service1Id,
        barbershopId: shopId,
        title: "Corte Cabelo Contract",
        priceInCents: 4500,
        durationInMinutes: 30,
        isActive: true,
      },
      {
        id: service2Id,
        barbershopId: shopId,
        title: "Barba Terapia Contract",
        priceInCents: 3500,
        durationInMinutes: 30,
        isActive: true,
      },
    ]);

    // 5. Auth Tokens
    ownerToken = sign({ sub: ownerUserId, version: 0 }, env.JWT_SECRET);
    barberToken = sign({ sub: barberUserId, version: 0 }, env.JWT_SECRET);
    customerToken = sign({ sub: customerUserId, version: 0 }, env.JWT_SECRET);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
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
        .delete(operationAttempts)
        .where(inArray(operationAttempts.actorId, testUserIds));
      await db
        .delete(notifications)
        .where(inArray(notifications.userId, testUserIds));
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
  });

  it("should expose GET /docs-json with valid OpenAPI specification", async () => {
    const res = await fetch(`${baseUrl}/docs-json`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as any;

    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("SmartBarber API");
    expect(doc.paths).toHaveProperty("/docs-json");
    expect(doc.paths).toHaveProperty("/api/bookings");
    expect(doc.paths).toHaveProperty("/api/barbershops/{shopId}/bookings");
    expect(doc.paths).toHaveProperty(
      "/api/barbershops/{shopId}/customers/lookup",
    );
    expect(doc.paths).toHaveProperty("/api/bookings/{bookingId}/cancel");
    expect(doc.paths).toHaveProperty("/api/bookings/{bookingId}/reschedule");
    expect(doc.paths).toHaveProperty("/api/bookings/{bookingId}/status");
  });

  it("should execute full lifecycle: create -> me -> get -> reschedule -> feed -> cancel", async () => {
    // 1. Create Booking (PERSONAL scope)
    const idempotencyKey = generateUuidV7();
    const createRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${customerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        scope: "PERSONAL",
        barbermanId: barberUserId,
        serviceIds: [service1Id],
        date: "2026-12-10",
        startTime: "10:00",
        expectedTotalPriceInCents: 4500,
        expectedDurationInMinutes: 30,
      }),
    });
    expect(createRes.status).toBe(201);
    expect(createRes.headers.get("cache-control")).toBe("no-store");
    const createBody = (await createRes.json()) as any;
    expect(createBody).toHaveProperty("booking");

    const createdBooking = createBody.booking;
    testBookingIds.push(createdBooking.id);
    expect(createdBooking.version).toBe(1);
    expect(createdBooking.status).toBe("CONFIRMED");
    expect(createdBooking.totalPriceInCents).toBe(4500);
    expect(createdBooking.totalDurationInMinutes).toBe(30);
    expect(createdBooking.canCancel).toBe(true);
    expect(createdBooking.canReschedule).toBe(true);
    expect(createdBooking.services).toHaveLength(1);
    expect(createdBooking.services[0].title).toBe("Corte Cabelo Contract");

    // 2. Idempotency Replay with same key
    const replayRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${customerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        scope: "PERSONAL",
        barbermanId: barberUserId,
        serviceIds: [service1Id],
        date: "2026-12-10",
        startTime: "10:00",
        expectedTotalPriceInCents: 4500,
        expectedDurationInMinutes: 30,
      }),
    });
    expect(replayRes.status).toBe(201);
    const replayBody = (await replayRes.json()) as any;
    expect(replayBody.booking.id).toBe(createdBooking.id);

    // 3. Fetch My Bookings (GET /api/bookings/me)
    const meRes = await fetch(`${baseUrl}/api/bookings/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as any;
    expect(meBody).toHaveProperty("bookings");
    expect(Array.isArray(meBody.bookings)).toBe(true);
    const foundInMe = meBody.bookings.find(
      (b: any) => b.id === createdBooking.id,
    );
    expect(foundInMe).toBeDefined();
    expect(foundInMe.version).toBe(1);
    expect(foundInMe.canCancel).toBe(true);

    // 4. Fetch Single Booking (GET /api/bookings/:bookingId)
    const detailRes = await fetch(
      `${baseUrl}/api/bookings/${createdBooking.id}`,
      {
        headers: { Authorization: `Bearer ${customerToken}` },
      },
    );
    expect(detailRes.status).toBe(200);
    expect(detailRes.headers.get("cache-control")).toBe("no-store");
    const detailBody = (await detailRes.json()) as any;
    expect(detailBody.booking.id).toBe(createdBooking.id);
    expect(detailBody.booking.version).toBe(1);

    // 5. Reschedule Booking (PATCH /api/bookings/:bookingId/reschedule)
    const rescheduleRes = await fetch(
      `${baseUrl}/api/bookings/${createdBooking.id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-12-10",
          startTime: "11:00",
          serviceIds: [service1Id, service2Id],
          expectedTotalPriceInCents: 8000,
          expectedDurationInMinutes: 60,
          expectedVersion: 1,
        }),
      },
    );
    expect(rescheduleRes.status).toBe(200);
    const rescheduleBody = (await rescheduleRes.json()) as any;
    expect(rescheduleBody.booking.version).toBe(2);
    expect(rescheduleBody.booking.startTime).toBe("11:00");
    expect(rescheduleBody.booking.endTime).toBe("12:00");
    expect(rescheduleBody.booking.totalPriceInCents).toBe(8000);
    expect(rescheduleBody.booking.services).toHaveLength(2);

    // 6. Version conflict check
    const staleRescheduleRes = await fetch(
      `${baseUrl}/api/bookings/${createdBooking.id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-12-10",
          startTime: "14:00",
          expectedVersion: 1, // Current version is now 2!
        }),
      },
    );
    expect(staleRescheduleRes.status).toBe(409);
    const conflictBody = (await staleRescheduleRes.json()) as any;
    expect(conflictBody.error).toBe("BOOKING_VERSION_CONFLICT");

    // 7. Check Notification in Barber feed
    const barberNotificationsRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${barberToken}` },
    });
    expect(barberNotificationsRes.status).toBe(200);
    const notificationsBody = (await barberNotificationsRes.json()) as any;
    expect(notificationsBody).toHaveProperty("notifications");
    const rescheduleNotice = notificationsBody.notifications.find(
      (n: any) =>
        n.referenceId === createdBooking.id && n.type === "BOOKING_RESCHEDULED",
    );
    expect(rescheduleNotice).toBeDefined();

    // 8. Cancel Booking (DELETE /api/bookings/:bookingId/cancel)
    const cancelRes = await fetch(
      `${baseUrl}/api/bookings/${createdBooking.id}/cancel`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Imprevisto pessoal",
          expectedVersion: 2,
        }),
      },
    );
    expect(cancelRes.status).toBe(200);
    const cancelBody = (await cancelRes.json()) as any;
    expect(cancelBody.booking.status).toBe("CANCELLED");
    expect(cancelBody.booking.version).toBe(3);

    // 9. Verify Terminal State: Cannot reschedule cancelled booking
    const cancelAgainRes = await fetch(
      `${baseUrl}/api/bookings/${createdBooking.id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-12-10",
          startTime: "15:00",
        }),
      },
    );
    expect(cancelAgainRes.status).toBe(409);
    const cancelAgainBody = (await cancelAgainRes.json()) as any;
    expect(cancelAgainBody.code).toBe("TERMINAL_BOOKING_STATE");
  });
});
