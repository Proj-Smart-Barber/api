import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { inArray } from "drizzle-orm";
import { sign } from "jsonwebtoken";
import app from "../../../../app";
import { env } from "../../../env";
import { db } from "../../../drizzle";
import {
  users,
  barbershops,
  membership,
  services,
  bookings,
  bookingServiceItems,
} from "../../../drizzle/schema";

describe("GET /api/bookings/me — Upcoming & History (Grupo 1)", () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserIds: string[] = [];
  const testShopIds: string[] = [];
  const testServiceIds: string[] = [];
  const testBookingIds: string[] = [];

  let ownerUserId: string;
  let barberUserId: string;
  let customerUserId: string;
  let otherCustomerUserId: string;
  let shopId: string;
  let serviceId: string;

  let customerToken: string;
  let otherCustomerToken: string;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 1. Users
    ownerUserId = randomUUID();
    barberUserId = randomUUID();
    customerUserId = randomUUID();
    otherCustomerUserId = randomUUID();
    testUserIds.push(
      ownerUserId,
      barberUserId,
      customerUserId,
      otherCustomerUserId,
    );

    await db.insert(users).values([
      {
        id: ownerUserId,
        name: "Owner User",
        email: `owner-${ownerUserId.slice(0, 8)}@test.com`,
        password: "hashedpassword123",
        accountType: "OWNER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: barberUserId,
        name: "Barber Staff",
        email: `barber-${barberUserId.slice(0, 8)}@test.com`,
        password: "hashedpassword123",
        accountType: "BARBERMAN",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: customerUserId,
        name: "Primary Customer",
        email: `customer-${customerUserId.slice(0, 8)}@test.com`,
        password: "hashedpassword123",
        accountType: "CLIENT",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: otherCustomerUserId,
        name: "Other Customer",
        email: `other-${otherCustomerUserId.slice(0, 8)}@test.com`,
        password: "hashedpassword123",
        accountType: "CLIENT",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
    ]);

    // 2. Barbershop & Membership
    shopId = randomUUID();
    testShopIds.push(shopId);

    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Proxima Atendimento",
      slug: `shop-next-${shopId.slice(0, 8)}`,
      cnpj: Math.floor(
        10000000000000 + Math.random() * 90000000000000,
      ).toString(),
      location: "Rua Teste Próximo, 100",
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

    // 3. Service
    serviceId = randomUUID();
    testServiceIds.push(serviceId);
    await db.insert(services).values({
      id: serviceId,
      barbershopId: shopId,
      title: "Corte e Barba VIP",
      priceInCents: 6500,
      durationInMinutes: 45,
      isActive: true,
    });

    // 4. Tokens
    customerToken = sign({ sub: customerUserId, version: 0 }, env.JWT_SECRET);
    otherCustomerToken = sign(
      { sub: otherCustomerUserId, version: 0 },
      env.JWT_SECRET,
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
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
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
  });

  it("deve retornar vazio com serverTime quando o cliente não tiver reservas", async () => {
    const res = await fetch(
      `${baseUrl}/api/bookings/me?view=upcoming&limit=1`,
      {
        headers: { Authorization: `Bearer ${otherCustomerToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bookings).toEqual([]);
    expect(data.serverTime).toBeDefined();
    expect(new Date(data.serverTime).getTime()).not.toBeNaN();
  });

  it("deve filtrar terminal statuses (CANCELLED, COMPLETED, NO_SHOW) e retornar a mais próxima futura mesmo com mais de 20 reservas no histórico", async () => {
    const now = new Date();

    // Inserir 22 reservas passadas (ocupam mais de 1 página do histórico)
    const pastBookings = [];
    for (let i = 1; i <= 22; i++) {
      const bId = randomUUID();
      testBookingIds.push(bId);
      const pastStart = new Date(
        now.getTime() - (30 - i) * 24 * 60 * 60 * 1000,
      );
      const pastEnd = new Date(pastStart.getTime() + 30 * 60 * 1000);
      pastBookings.push({
        id: bId,
        barbershopId: shopId,
        barbermanId: barberUserId,
        customerId: customerUserId,
        date: pastStart,
        startTime: "10:00",
        endTime: "10:30",
        startsAt: pastStart,
        endsAt: pastEnd,
        timezone: "America/Sao_Paulo",
        version: 1,
        status: "COMPLETED",
        totalPriceInCents: 6500,
        totalDurationInMinutes: 30,
      });
    }

    // Inserir 1 reserva cancelada no futuro
    const cancelledId = randomUUID();
    testBookingIds.push(cancelledId);
    const cancelledStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    pastBookings.push({
      id: cancelledId,
      barbershopId: shopId,
      barbermanId: barberUserId,
      customerId: customerUserId,
      date: cancelledStart,
      startTime: "12:00",
      endTime: "12:30",
      startsAt: cancelledStart,
      endsAt: new Date(cancelledStart.getTime() + 30 * 60 * 1000),
      timezone: "America/Sao_Paulo",
      version: 1,
      status: "CANCELLED",
      totalPriceInCents: 6500,
      totalDurationInMinutes: 30,
    });

    // Inserir 1 reserva confirmada daqui a 5 horas (essa é a próxima global!)
    const nextFutureId = randomUUID();
    testBookingIds.push(nextFutureId);
    const nextStart = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    pastBookings.push({
      id: nextFutureId,
      barbershopId: shopId,
      barbermanId: barberUserId,
      customerId: customerUserId,
      date: nextStart,
      startTime: "15:00",
      endTime: "15:30",
      startsAt: nextStart,
      endsAt: new Date(nextStart.getTime() + 30 * 60 * 1000),
      timezone: "America/Sao_Paulo",
      version: 1,
      status: "CONFIRMED",
      totalPriceInCents: 6500,
      totalDurationInMinutes: 30,
    });

    // Inserir 1 reserva confirmada daqui a 2 dias (posterior à próxima)
    const laterFutureId = randomUUID();
    testBookingIds.push(laterFutureId);
    const laterStart = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    pastBookings.push({
      id: laterFutureId,
      barbershopId: shopId,
      barbermanId: barberUserId,
      customerId: customerUserId,
      date: laterStart,
      startTime: "16:00",
      endTime: "16:30",
      startsAt: laterStart,
      endsAt: new Date(laterStart.getTime() + 30 * 60 * 1000),
      timezone: "America/Sao_Paulo",
      version: 1,
      status: "CONFIRMED",
      totalPriceInCents: 6500,
      totalDurationInMinutes: 30,
    });

    await db.insert(bookings).values(pastBookings);

    // Consulta com view=upcoming&limit=1
    const res = await fetch(
      `${baseUrl}/api/bookings/me?view=upcoming&limit=1`,
      {
        headers: { Authorization: `Bearer ${customerToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].id).toBe(nextFutureId);
    expect(data.bookings[0].status).toBe("CONFIRMED");
    expect(data.serverTime).toBeDefined();

    // Consulta normal (sem view) preserva o histórico paginado
    const historyRes = await fetch(`${baseUrl}/api/bookings/me?page=1`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(historyRes.status).toBe(200);
    const historyData = (await historyRes.json()) as any;
    expect(historyData.bookings.length).toBeGreaterThan(0);
    expect(historyData.serverTime).toBeDefined();
  });

  it("deve incluir atendimento CONFIRMED em andamento como próximo atendimento", async () => {
    const now = new Date();
    const inProgressId = randomUUID();
    testBookingIds.push(inProgressId);

    // Começou há 10 minutos, termina daqui a 20 minutos
    const startsAt = new Date(now.getTime() - 10 * 60 * 1000);
    const endsAt = new Date(now.getTime() + 20 * 60 * 1000);

    await db.insert(bookings).values({
      id: inProgressId,
      barbershopId: shopId,
      barbermanId: barberUserId,
      customerId: otherCustomerUserId,
      date: startsAt,
      startTime: "11:00",
      endTime: "11:30",
      startsAt,
      endsAt,
      timezone: "America/Sao_Paulo",
      version: 1,
      status: "CONFIRMED",
      totalPriceInCents: 6500,
      totalDurationInMinutes: 30,
    });

    const res = await fetch(
      `${baseUrl}/api/bookings/me?view=upcoming&limit=1`,
      {
        headers: { Authorization: `Bearer ${otherCustomerToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].id).toBe(inProgressId);
    expect(data.serverTime).toBeDefined();
  });
});
