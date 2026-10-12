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

describe("Booking Actions Contract & Idempotency E2E (Task I2)", () => {
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

    ownerUserId = randomUUID();
    barberUserId = randomUUID();
    customerUserId = randomUUID();
    testUserIds.push(ownerUserId, barberUserId, customerUserId);

    await db.insert(users).values([
      {
        id: ownerUserId,
        name: "Actions Contract Owner",
        email: `owner_${Date.now()}_${ownerUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "OWNER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: barberUserId,
        name: "Actions Contract Barber",
        email: `barber_${Date.now()}_${barberUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "BARBER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: customerUserId,
        name: "Actions Contract Customer",
        email: `cust_${Date.now()}_${customerUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "CLIENT",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
    ]);

    shopId = randomUUID();
    testShopIds.push(shopId);

    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Actions Contract",
      slug: `shop-actions-${shopId.slice(0, 8)}`,
      cnpj: randomCnpj(),
      location: "Rua Acoes, 100",
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

    service1Id = randomUUID();
    service2Id = randomUUID();
    testServiceIds.push(service1Id, service2Id);

    await db.insert(services).values([
      {
        id: service1Id,
        barbershopId: shopId,
        title: "Corte Acao",
        priceInCents: 5000,
        durationInMinutes: 30,
        isActive: true,
      },
      {
        id: service2Id,
        barbershopId: shopId,
        title: "Barba Acao",
        priceInCents: 4000,
        durationInMinutes: 30,
        isActive: true,
      },
    ]);

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
    if (testUserIds.length > 0) {
      await db
        .delete(notifications)
        .where(inArray(notifications.userId, testUserIds));
      await db
        .delete(operationAttempts)
        .where(inArray(operationAttempts.actorId, testUserIds));
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
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
  });

  async function createTestBooking(date: string, startTime: string) {
    const createReqId = generateUuidV7();
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${customerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": createReqId,
      },
      body: JSON.stringify({
        shopId,
        serviceIds: [service1Id],
        barbermanId: barberUserId,
        date,
        startTime,
      }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    testBookingIds.push(data.booking.id);
    return data.booking;
  }

  it("should enforce Idempotency-Key and ledger on DELETE /api/bookings/:bookingId/cancel", async () => {
    // Agendamento para 3 dias no futuro para permitir cancelamento pessoal
    const booking = await createTestBooking("2026-10-25", "10:00");
    const cancelReqId = generateUuidV7();

    // 1ª chamada de cancelamento com Idempotency-Key
    const cancelRes1 = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/cancel`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": cancelReqId,
        },
        body: JSON.stringify({
          expectedVersion: booking.version,
          reason: "Imprevisto pessoal",
          scope: "PERSONAL",
        }),
      },
    );

    expect(cancelRes1.status).toBe(200);
    const cancelData1 = (await cancelRes1.json()) as any;
    expect(cancelData1.booking.status).toBe("CANCELLED");
    expect(cancelData1.booking.version).toBe(booking.version + 1);

    // 2ª chamada (replay com mesma Idempotency-Key)
    const cancelRes2 = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/cancel`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": cancelReqId,
        },
        body: JSON.stringify({
          expectedVersion: booking.version,
          reason: "Imprevisto pessoal",
          scope: "PERSONAL",
        }),
      },
    );

    expect(cancelRes2.status).toBe(200);
    const cancelData2 = (await cancelRes2.json()) as any;
    expect(cancelData2.booking.id).toBe(booking.id);
    expect(cancelData2.booking.status).toBe("CANCELLED");
    expect(cancelData2.booking.version).toBe(booking.version + 1);

    // Conferir se attempt existe no ledger
    const attemptRes = await fetch(
      `${baseUrl}/api/operation-attempts/${cancelReqId}`,
      {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      },
    );
    expect(attemptRes.status).toBe(200);
    const attemptData = (await attemptRes.json()) as any;
    expect(attemptData.state).toBe("APPLIED");
    expect(attemptData.resource.kind).toBe("BOOKING");
    expect(attemptData.resource.id).toBe(booking.id);
  });

  it("should enforce Idempotency-Key and ledger on PATCH /api/bookings/:bookingId/reschedule", async () => {
    const booking = await createTestBooking("2026-10-26", "14:00");
    const rescheduleReqId = generateUuidV7();

    const rescheduleRes1 = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": rescheduleReqId,
        },
        body: JSON.stringify({
          expectedVersion: booking.version,
          date: "2026-10-26",
          startTime: "16:00",
          serviceIds: [service1Id],
          scope: "PERSONAL",
        }),
      },
    );

    expect(rescheduleRes1.status).toBe(200);
    const resData1 = (await rescheduleRes1.json()) as any;
    expect(resData1.booking.startTime).toBe("16:00");
    expect(resData1.booking.version).toBe(booking.version + 1);

    // Replay com mesma Idempotency-Key
    const rescheduleRes2 = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": rescheduleReqId,
        },
        body: JSON.stringify({
          expectedVersion: booking.version,
          date: "2026-10-26",
          startTime: "16:00",
          serviceIds: [service1Id],
          scope: "PERSONAL",
        }),
      },
    );

    expect(rescheduleRes2.status).toBe(200);
    const resData2 = (await rescheduleRes2.json()) as any;
    expect(resData2.booking.startTime).toBe("16:00");
    expect(resData2.booking.version).toBe(booking.version + 1);

    // Conferir se attempt existe no ledger
    const attemptRes = await fetch(
      `${baseUrl}/api/operation-attempts/${rescheduleReqId}`,
      {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      },
    );
    expect(attemptRes.status).toBe(200);
    const attemptData = (await attemptRes.json()) as any;
    expect(attemptData.state).toBe("APPLIED");
    expect(attemptData.resource.id).toBe(booking.id);
  });

  it("should enforce Idempotency-Key and ledger on PATCH /api/bookings/:bookingId/status", async () => {
    // Criar reserva com horário passado para barbeiro poder marcar COMPLETED
    const booking = await createTestBooking("2026-10-27", "11:00");

    // Atualizar no banco startsAt para o passado para permitir canComplete
    await db
      .update(bookings)
      .set({ startsAt: new Date(Date.now() - 3600 * 1000) })
      .where(inArray(bookings.id, [booking.id]));

    const statusReqId = generateUuidV7();

    const statusRes1 = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${barberToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": statusReqId,
        },
        body: JSON.stringify({
          status: "COMPLETED",
          expectedVersion: booking.version,
        }),
      },
    );

    expect(statusRes1.status).toBe(200);
    const statusData1 = (await statusRes1.json()) as any;
    expect(statusData1.booking.status).toBe("COMPLETED");

    // Replay com mesma Idempotency-Key
    const statusRes2 = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${barberToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": statusReqId,
        },
        body: JSON.stringify({
          status: "COMPLETED",
          expectedVersion: booking.version,
        }),
      },
    );

    expect(statusRes2.status).toBe(200);
    const statusData2 = (await statusRes2.json()) as any;
    expect(statusData2.booking.status).toBe("COMPLETED");

    const attemptRes = await fetch(
      `${baseUrl}/api/operation-attempts/${statusReqId}`,
      {
        headers: {
          Authorization: `Bearer ${barberToken}`,
        },
      },
    );
    expect(attemptRes.status).toBe(200);
    const attemptData = (await attemptRes.json()) as any;
    expect(attemptData.state).toBe("APPLIED");
  });

  it("should reject invalid UUIDv7 Idempotency-Key with 400", async () => {
    const booking = await createTestBooking("2026-10-28", "10:00");

    const res = await fetch(`${baseUrl}/api/bookings/${booking.id}/cancel`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${customerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "not-a-uuid-v7",
      },
      body: JSON.stringify({
        expectedVersion: booking.version,
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });
});
