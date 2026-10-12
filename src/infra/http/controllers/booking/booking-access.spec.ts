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
  customerLookupRateLimits,
} from "../../../drizzle/schema";

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

describe("Booking Access, Lookups & Scopes HTTP (Task B3)", () => {
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
  let outsiderUserId: string;
  let customerUserId: string;
  let customerCpf: string;
  let customerEmail: string;

  let ownerToken: string;
  let barberToken: string;
  let outsiderToken: string;

  let shopId: string;
  let serviceId: string;

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
    outsiderUserId = randomUUID();
    customerUserId = randomUUID();
    customerCpf = generateValidCpf();
    customerEmail = `customer_${Date.now()}@example.com`;

    testUserIds.push(ownerUserId, barberUserId, outsiderUserId, customerUserId);

    await db.insert(users).values([
      {
        id: ownerUserId,
        name: "Shop Owner Access",
        email: `owner_${Date.now()}_${ownerUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "OWNER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: barberUserId,
        name: "Barber Staff Access",
        email: `barber_${Date.now()}_${barberUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "BARBER",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: outsiderUserId,
        name: "Outsider User",
        email: `outsider_${Date.now()}_${outsiderUserId.slice(0, 5)}@test.com`,
        password: "hash",
        cpf: generateValidCpf(),
        accountType: "CLIENT",
        credentialVersion: 0,
        emailVerifiedAt: new Date(),
      },
      {
        id: customerUserId,
        name: "Target Customer",
        email: customerEmail,
        password: "hash",
        cpf: customerCpf,
        phoneNumber: "11987654321",
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
      name: "Barbearia Access Test",
      slug: `shop-acc-${shopId.slice(0, 8)}`,
      cnpj: randomCnpj(),
      location: "Rua Acesso, 500",
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

    // 4. Service
    serviceId = randomUUID();
    testServiceIds.push(serviceId);

    await db.insert(services).values({
      id: serviceId,
      barbershopId: shopId,
      title: "Corte Access",
      priceInCents: 5000,
      durationInMinutes: 30,
      isActive: true,
    });

    // 5. Auth Tokens
    ownerToken = sign({ sub: ownerUserId, version: 0 }, env.JWT_SECRET);
    barberToken = sign({ sub: barberUserId, version: 0 }, env.JWT_SECRET);
    outsiderToken = sign({ sub: outsiderUserId, version: 0 }, env.JWT_SECRET);
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
    await db.delete(customerLookupRateLimits);
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

  describe("POST /api/barbershops/:shopId/customers/lookup", () => {
    it("should allow authorized staff to lookup customer by exact CPF and return minimal masked data", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/customers/lookup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${barberToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf: customerCpf }),
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = (await response.json()) as any;
      expect(body.id).toBe(customerUserId);
      expect(body.name).toBe("Target Customer");
      expect(body.maskedEmail).toBeDefined();
      expect(body.maskedPhone).toBeDefined();
      expect(body.isEligible).toBe(true);

      // PII Protection: full CPF must NEVER be returned!
      expect(body).not.toHaveProperty("cpf");
    });

    it("should allow authorized owner to lookup customer by exact email", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/customers/lookup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: customerEmail }),
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.id).toBe(customerUserId);
      expect(body.maskedEmail).toContain("***");
    });

    it("should reject lookup from unauthorized outsider with 403", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/customers/lookup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${outsiderToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf: customerCpf }),
        },
      );

      expect(response.status).toBe(403);
    });

    it("should reject lookup with both CPF and email with 400", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/customers/lookup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${barberToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf: customerCpf, email: customerEmail }),
        },
      );

      expect(response.status).toBe(400);
    });

    it("should enforce 30 requests/minute rate limit and return 429 with Retry-After", async () => {
      const spamToken = sign({ sub: ownerUserId, version: 0 }, env.JWT_SECRET);

      let lastStatus = 200;
      let retryAfterHeader: string | null = null;
      let cacheControlHeader: string | null = null;

      for (let i = 0; i < 35; i++) {
        const res = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/customers/lookup`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${spamToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cpf: generateValidCpf() }),
          },
        );

        lastStatus = res.status;
        if (res.status === 429) {
          retryAfterHeader = res.headers.get("retry-after");
          cacheControlHeader = res.headers.get("cache-control");
          break;
        }
      }

      expect(lastStatus).toBe(429);
      expect(retryAfterHeader).toBeDefined();
      expect(cacheControlHeader).toBe("no-store");
    });
  });

  describe("GET /api/barbershops/:shopId/bookings (Pagination & SQL Summary)", () => {
    beforeAll(async () => {
      const bookingInserts = [];
      for (let i = 1; i <= 21; i++) {
        const id = randomUUID();
        testBookingIds.push(id);
        const day = String(i).padStart(2, "0");
        bookingInserts.push({
          id,
          barbershopId: shopId,
          barbermanId: barberUserId,
          customerId: customerUserId,
          date: new Date(`2026-12-${day}T00:00:00.000Z`),
          startTime: "09:00",
          endTime: "09:30",
          startsAt: new Date(`2026-12-${day}T12:00:00.000Z`),
          endsAt: new Date(`2026-12-${day}T12:30:00.000Z`),
          timezone: "America/Sao_Paulo",
          version: 1,
          status: "CONFIRMED",
          totalPriceInCents: 5000,
          totalDurationInMinutes: 30,
        });
      }

      await db.insert(bookings).values(bookingInserts);
    });

    it("should return page 1 (20 items, hasNext=true) and full filter summary (21 total)", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/bookings?page=1&limit=20`,
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body).toHaveProperty("items");
      expect(body.items).toHaveLength(20);

      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.total).toBe(21);
      expect(body.hasNext).toBe(true);

      expect(body.summary).toEqual({
        totalBookings: 21,
        totalAmountInCents: 21 * 5000,
        statusCounts: {
          CONFIRMED: 21,
        },
        hasIncompleteData: false,
      });
    });

    it("should return page 2 (1 item, hasNext=false) with identical full filter summary", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/bookings?page=2&limit=20`,
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.items).toHaveLength(1);

      expect(body.page).toBe(2);
      expect(body.limit).toBe(20);
      expect(body.total).toBe(21);
      expect(body.hasNext).toBe(false);

      expect(body.summary).toEqual({
        totalBookings: 21,
        totalAmountInCents: 21 * 5000,
        statusCounts: {
          CONFIRMED: 21,
        },
        hasIncompleteData: false,
      });
    });

    it("should scope queries: barber only sees own agenda; outsider is forbidden", async () => {
      const barberRes = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/bookings?page=1&limit=5`,
        {
          headers: { Authorization: `Bearer ${barberToken}` },
        },
      );

      expect(barberRes.status).toBe(200);
      const barberBody = (await barberRes.json()) as any;
      expect(barberBody.items.length).toBeGreaterThan(0);
      expect(
        barberBody.items.every((b: any) => b.barbermanId === barberUserId),
      ).toBe(true);

      const outsiderRes = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/bookings`,
        {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        },
      );

      expect(outsiderRes.status).toBe(403);
    });
  });

  describe("GET /api/bookings/:bookingId (Rich DTO & Capabilities)", () => {
    it("should return rich BookingDto with capabilities, snapshots and serverTime", async () => {
      const targetBookingId = testBookingIds[0];

      const response = await fetch(
        `${baseUrl}/api/bookings/${targetBookingId}`,
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = (await response.json()) as any;
      expect(body).toHaveProperty("booking");

      const b = body.booking;
      expect(b.id).toBe(targetBookingId);
      expect(b.capabilities).toBeDefined();
      expect(typeof b.canCancel).toBe("boolean");
      expect(typeof b.canReschedule).toBe("boolean");
      expect(typeof b.canComplete).toBe("boolean");
      expect(typeof b.canMarkNoShow).toBe("boolean");
      expect(typeof b.capabilities.cancel.allowed).toBe("boolean");
      expect(b.serverTime).toBeDefined();
    });
  });
});
