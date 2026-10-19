import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { inArray, eq, and } from "drizzle-orm";
import { DrizzleNotificationsRepository } from "../drizzle/repositories/drizzle-notifications-repository";
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
  barbershopSchedules,
  barbershopScheduleScopes,
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

    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];

    await db.insert(barbershopScheduleScopes).values([
      {
        id: randomUUID(),
        barbershopId: shopId,
        barbermanId: null,
        state: "CUSTOM",
        version: 1,
      },
      {
        id: randomUUID(),
        barbershopId: shopId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        version: 1,
      },
    ]);

    for (const day of days) {
      await db.insert(barbershopSchedules).values([
        {
          id: randomUUID(),
          barbershopId: shopId,
          createdBy: ownerUserId,
          dayOfWeek: day,
          openTime: "07:00",
          closeTime: "22:00",
        },
        {
          id: randomUUID(),
          barbershopId: shopId,
          barbermanId: barberUserId,
          createdBy: barberUserId,
          dayOfWeek: day,
          openTime: "07:00",
          closeTime: "22:00",
        },
      ]);
    }
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
        .delete(barbershopSchedules)
        .where(inArray(barbershopSchedules.barbershopId, testShopIds));
      await db
        .delete(barbershopScheduleScopes)
        .where(inArray(barbershopScheduleScopes.barbershopId, testShopIds));
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
    const notices = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.referenceId, booking.id),
          eq(notifications.type, "BOOKING_CANCELLED"),
        ),
      );
    expect(notices.map((n) => n.userId).sort()).toEqual(
      [ownerUserId, barberUserId, customerUserId].sort(),
    );
    expect(notices.every((n) => n.message.includes("25/10/2026"))).toBe(true);
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
    const notices = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.referenceId, booking.id),
          eq(notifications.type, "BOOKING_RESCHEDULED"),
        ),
      );
    expect(notices.map((n) => n.userId).sort()).toEqual(
      [ownerUserId, barberUserId, customerUserId].sort(),
    );
    expect(notices.every((n) => n.message.includes("26/10/2026"))).toBe(true);
    expect(new Date(resData1.booking.startsAt).toISOString()).toBe(
      "2026-10-26T19:00:00.000Z",
    );
    expect(new Date(resData1.booking.endsAt).toISOString()).toBe(
      "2026-10-26T19:30:00.000Z",
    );

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

  it("includes the selected instant in the creation payload hash", async () => {
    const key = generateUuidV7();
    const send = (slotStartAt: string) =>
      fetch(`${baseUrl}/api/bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          scope: "PERSONAL",
          shopId,
          serviceIds: [service1Id],
          barbermanId: barberUserId,
          date: "2026-11-16",
          startTime: "10:00",
          slotStartAt,
        }),
      });
    const first = await send("2026-11-16T13:00:00.000Z");
    expect(first.status).toBe(201);
    testBookingIds.push(((await first.json()) as any).booking.id);
    const different = await send("2026-11-16T14:00:00.000Z");
    expect(different.status).toBe(409);
    expect(((await different.json()) as any).code).toBe(
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
    );
  });
  it("rejects missing key and missing version on new mutations", async () => {
    const booking = await createTestBooking("2026-11-12", "10:00");
    const missingKey = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/cancel`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: booking.version,
          scope: "PERSONAL",
        }),
      },
    );
    expect(missingKey.status).toBe(400);
    const missingVersion = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/cancel`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": generateUuidV7(),
        },
        body: JSON.stringify({ scope: "PERSONAL" }),
      },
    );
    expect(missingVersion.status).toBe(400);
  });
  it("denies UNIT detail after professional membership is deactivated", async () => {
    const booking = await createTestBooking("2026-11-13", "10:00");
    await db
      .update(membership)
      .set({ state: "INACTIVE" })
      .where(eq(membership.userId, barberUserId));
    try {
      const response = await fetch(
        `${baseUrl}/api/bookings/${booking.id}?scope=UNIT`,
        { headers: { Authorization: `Bearer ${barberToken}` } },
      );
      expect(response.status).toBe(404);
      const personal = await fetch(
        `${baseUrl}/api/bookings/${booking.id}?scope=PERSONAL`,
        { headers: { Authorization: `Bearer ${customerToken}` } },
      );
      expect(personal.status).toBe(200);
    } finally {
      await db
        .update(membership)
        .set({ state: "ACTIVE" })
        .where(eq(membership.userId, barberUserId));
    }
  });
  it("recovers a cancellation when connection is lost after server commit", async () => {
    const booking = await createTestBooking("2026-11-14", "10:00");
    const key = generateUuidV7();
    const proxy = http.createServer(async (request, response) => {
      try {
        const upstream = await fetch(
          `${baseUrl}/api/bookings/${booking.id}/cancel`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${customerToken}`,
              "Content-Type": "application/json",
              "Idempotency-Key": key,
            },
            body: JSON.stringify({
              scope: "PERSONAL",
              expectedVersion: booking.version,
            }),
          },
        );
        await upstream.text();
        response.destroy();
      } catch {
        response.destroy();
      }
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    try {
      await expect(
        fetch(`http://127.0.0.1:${(proxy.address() as AddressInfo).port}`),
      ).rejects.toThrow();
      const result = await fetch(`${baseUrl}/api/operation-attempts/${key}`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const data = (await result.json()) as any;
      expect(data.state).toBe("APPLIED");
      expect(data.resource.id).toBe(booking.id);
      expect(data.resource.data.booking.version).toBe(booking.version + 1);
      const close = await fetch(
        `${baseUrl}/api/operation-attempts/${key}/close`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${customerToken}` },
        },
      );
      expect(((await close.json()) as any).state).toBe("APPLIED");
    } finally {
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
  });

  const sendReschedule = (
    booking: any,
    token: string,
    overrides: Record<string, unknown> = {},
    key = generateUuidV7(),
  ) =>
    fetch(`${baseUrl}/api/bookings/${booking.id}/reschedule`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        scope: token === customerToken ? "PERSONAL" : "UNIT",
        expectedVersion: booking.version,
        date: "2026-11-22",
        startTime: "15:00",
        ...overrides,
      }),
    });

  it("does not expose the unsafe update path or accept a keyless reschedule", async () => {
    const booking = await createTestBooking("2026-11-20", "10:00");
    const old = await fetch(`${baseUrl}/api/bookings/${booking.id}/update`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${barberToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startTime: "11:00" }),
    });
    expect(old.status).toBe(404);
    const noKey = await fetch(
      `${baseUrl}/api/bookings/${booking.id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${barberToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "UNIT",
          expectedVersion: booking.version,
          date: "2026-11-20",
          startTime: "11:00",
        }),
      },
    );
    expect(noKey.status).toBe(400);
    const missingVersion = await sendReschedule(booking, barberToken, {
      expectedVersion: undefined,
    });
    expect(missingVersion.status).toBe(400);
  });

  it.each(["CANCELLED", "COMPLETED", "NO_SHOW"])(
    "rejects rescheduling terminal state %s",
    async (status) => {
      const booking = await createTestBooking(
        "2026-11-21",
        status === "CANCELLED"
          ? "09:00"
          : status === "COMPLETED"
            ? "10:00"
            : "11:00",
      );
      await db
        .update(bookings)
        .set({ status })
        .where(eq(bookings.id, booking.id));
      const response = await sendReschedule(booking, barberToken);
      expect(response.status).toBe(409);
      expect(((await response.json()) as any).code).toBe(
        "TERMINAL_BOOKING_STATE",
      );
    },
  );

  it("rejects inactive professionals and expired personal deadlines", async () => {
    const booking = await createTestBooking("2026-11-23", "09:00");
    await db
      .update(membership)
      .set({ state: "INACTIVE" })
      .where(eq(membership.userId, barberUserId));
    try {
      expect((await sendReschedule(booking, barberToken)).status).toBe(403);
    } finally {
      await db
        .update(membership)
        .set({ state: "ACTIVE" })
        .where(eq(membership.userId, barberUserId));
    }
    await db
      .update(bookings)
      .set({ startsAt: new Date(Date.now() + 3600000) })
      .where(eq(bookings.id, booking.id));
    const response = await sendReschedule(booking, customerToken);
    expect(response.status).toBe(409);
    expect(((await response.json()) as any).code).toBe(
      "ACTION_DEADLINE_PASSED",
    );
  });

  it("serializes simultaneous edits and rejects a stale version", async () => {
    const booking = await createTestBooking("2026-11-24", "09:00");
    const results = await Promise.all([
      sendReschedule(booking, ownerToken, {
        date: "2026-11-24",
        startTime: "10:00",
      }),
      sendReschedule(booking, ownerToken, {
        date: "2026-11-24",
        startTime: "11:00",
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const bodies = (await Promise.all(results.map((r) => r.json()))) as any[];
    expect(bodies.find((b) => b.code)?.code).toBe("BOOKING_VERSION_CONFLICT");
    const [saved] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, booking.id));
    expect(saved.version).toBe(booking.version + 1);
    const events = await db
      .select()
      .from(bookingEvents)
      .where(
        and(
          eq(bookingEvents.bookingId, booking.id),
          eq(bookingEvents.eventType, "RESCHEDULED"),
        ),
      );
    expect(events).toHaveLength(1);
  });

  it("derives duration from selected services instead of caller endTime", async () => {
    const booking = await createTestBooking("2026-11-25", "09:00");
    const response = await sendReschedule(booking, ownerToken, {
      date: "2026-11-25",
      startTime: "10:00",
      serviceIds: [service1Id, service2Id],
      slotStartAt: "2026-11-25T13:00:00Z",
      endTime: "10:01",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.booking.endTime).toBe("11:00");
    expect(body.booking.totalDurationInMinutes).toBe(60);
    expect(body.booking.startsAt).toBe("2026-11-25T13:00:00.000Z");
    expect(body.booking.endsAt).toBe("2026-11-25T14:00:00.000Z");
  });

  it.each(["reschedule", "cancel"])(
    "rolls back %s, event and notifications if notification storage fails",
    async (action) => {
      const booking = await createTestBooking(
        "2026-11-26",
        action === "cancel" ? "10:00" : "09:00",
      );
      const beforeNotices = await db
        .select()
        .from(notifications)
        .where(eq(notifications.referenceId, booking.id));
      const spy = vi
        .spyOn(DrizzleNotificationsRepository.prototype, "createManyWithTx")
        .mockRejectedValue(new Error("Notification storage unavailable"));
      try {
        const response =
          action === "reschedule"
            ? await sendReschedule(booking, ownerToken, {
                date: "2026-11-26",
                startTime: "11:00",
              })
            : await fetch(`${baseUrl}/api/bookings/${booking.id}/cancel`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${ownerToken}`,
                  "Content-Type": "application/json",
                  "Idempotency-Key": generateUuidV7(),
                },
                body: JSON.stringify({
                  expectedVersion: booking.version,
                  scope: "UNIT",
                }),
              });
        expect(response.status).toBeGreaterThanOrEqual(400);
        const [saved] = await db
          .select()
          .from(bookings)
          .where(eq(bookings.id, booking.id));
        expect(saved.version).toBe(booking.version);
        expect(saved.status).toBe("CONFIRMED");
        expect(saved.startTime).toBe(booking.startTime);
        const events = await db
          .select()
          .from(bookingEvents)
          .where(
            and(
              eq(bookingEvents.bookingId, booking.id),
              eq(
                bookingEvents.eventType,
                action === "cancel" ? "CANCELLED" : "RESCHEDULED",
              ),
            ),
          );
        expect(events).toHaveLength(0);
        const afterNotices = await db
          .select()
          .from(notifications)
          .where(eq(notifications.referenceId, booking.id));
        expect(afterNotices.map((n) => n.id).sort()).toEqual(
          beforeNotices.map((n) => n.id).sort(),
        );
      } finally {
        spy.mockRestore();
      }
    },
  );
});
