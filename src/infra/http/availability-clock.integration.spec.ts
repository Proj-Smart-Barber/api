import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { sign } from "jsonwebtoken";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  createPhase1TestDatabase,
  validatePhase1TestUrl,
} from "../../../test/helpers/isolated-phase1-db";
import { generateUuidV7 } from "../../core/security/uuidv7";
import {
  users,
  barbershops,
  membership,
  services,
  barbershopSchedules,
  bookings,
} from "../drizzle/schema";
import { DrizzleBookingsRepository } from "../drizzle/repositories/drizzle-bookings-repository";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../drizzle/index", () => ({
  get db() {
    if (!state.db) throw new Error("Disposable database not ready");
    return state.db;
  },
}));
const testUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (testUrl) validatePhase1TestUrl(testUrl);
const availabilitySchema = z.object({
  slots: z.array(z.object({ start: z.string(), end: z.string() })),
  serverTime: z.string(),
  timezone: z.string(),
});
const createdSchema = z.object({
  booking: z.object({ id: z.uuid(), version: z.number() }),
});
const errorSchema = z.object({ code: z.string() });

describe.skipIf(!testUrl)(
  "Availability clock and client concurrency, real HTTP/PostgreSQL",
  () => {
    let isolated: Awaited<ReturnType<typeof createPhase1TestDatabase>>;
    let server: http.Server;
    let base: string;
    const date = "2030-01-15";
    let sequence = 0;

    beforeAll(async () => {
      if (!testUrl) throw new Error("Disposable test URL required");
      isolated = await createPhase1TestDatabase(testUrl);
      state.db = isolated.db;
      const { default: app } = await import("../../app.js");
      server = http.createServer(app as unknown as http.RequestListener);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }, 90_000);
    afterAll(async () => {
      try {
        if (server) {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
        }
      } finally {
        state.db = null;
        await isolated?.close();
      }
    });

    async function fixture() {
      const db = isolated.db;
      const ownerId = randomUUID(),
        barberId = randomUUID(),
        shopId = randomUUID(),
        serviceId = randomUUID();
      const clients = [randomUUID(), randomUUID()];
      for (const [index, id] of [ownerId, barberId, ...clients].entries()) {
        await db.insert(users).values({
          id,
          name: `Fixture ${index}`,
          email: `${id}@example.invalid`,
          password: "unused-fixture-hash",
          cpf: String(++sequence).padStart(11, "0"),
          accountType:
            index === 0 ? "OWNER" : index === 1 ? "BARBER" : "CLIENT",
          emailVerifiedAt: new Date(),
        });
      }
      await db.insert(barbershops).values({
        id: shopId,
        ownerId,
        name: "Fixture shop",
        slug: shopId,
        cnpj: String(++sequence).padStart(14, "0"),
        location: "Fixture address",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      });
      await db.insert(membership).values([
        {
          userId: ownerId,
          barbershopId: shopId,
          role: "OWNER",
          state: "ACTIVE",
        },
        {
          userId: barberId,
          barbershopId: shopId,
          role: "BARBERMAN",
          state: "ACTIVE",
        },
      ]);
      await db.insert(services).values({
        id: serviceId,
        barbershopId: shopId,
        title: "Fixture cut",
        priceInCents: 4000,
        durationInMinutes: 60,
        isActive: true,
      });
      for (const dayOfWeek of [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ] as const) {
        await db.insert(barbershopSchedules).values({
          barbershopId: shopId,
          barbermanId: barberId,
          createdBy: ownerId,
          dayOfWeek,
          openTime: "00:00",
          closeTime: "23:59",
        });
      }
      const token = (id: string) =>
        sign(
          { userId: id, credentialVersion: 0 },
          process.env.JWT_SECRET ?? "slot-clock-fixture-only",
          {
            subject: id,
            expiresIn: "1h",
          },
        );
      const body = {
        scope: "PERSONAL",
        shopId,
        serviceIds: [serviceId],
        barbermanId: barberId,
        date,
        startTime: "09:00",
        slotStartAt: `${date}T09:00:00-03:00`,
        expectedTotalPriceInCents: 4000,
        expectedDurationInMinutes: 60,
      };
      const read = (day = date) =>
        fetch(
          `${base}/api/barbershops/${shopId}/availability?date=${day}&serviceIds=${serviceId}&barbermanId=${barberId}`,
        );
      const create = (index: number, key = generateUuidV7(), payload = body) =>
        fetch(`${base}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token(clients[index])}`,
            "Idempotency-Key": key,
          },
          body: JSON.stringify(payload),
        });
      return {
        db,
        ownerId,
        barberId,
        shopId,
        serviceId,
        clients,
        body,
        read,
        create,
      };
    }

    it("returns only strictly future slots with an uncached server clock, including a past civil day", async () => {
      const f = await fixture();
      const response = await f.read("2000-01-01");
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(availabilitySchema.parse(await response.json()).slots).toEqual([]);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());
      const current = availabilitySchema.parse(
        await (await f.read(today)).json(),
      );
      expect(current.timezone).toBe("America/Sao_Paulo");
      expect(
        current.slots.every(
          (slot: { start: string }) =>
            Date.parse(slot.start) > Date.parse(current.serverTime),
        ),
      ).toBe(true);
      const past = await f.create(0, generateUuidV7(), {
        ...f.body,
        date: "2000-07-01",
        slotStartAt: "2000-07-01T09:00:00-03:00",
      });
      expect(past.status).toBe(409);
      expect(errorSchema.parse(await past.json()).code).toBe(
        "SLOT_UNAVAILABLE",
      );
      expect(
        await f.db
          .select()
          .from(bookings)
          .where(eq(bookings.barbershopId, f.shopId)),
      ).toHaveLength(0);
    });

    it("admits one of two clients concurrently; hides overlaps for the other client and replays idempotently", async () => {
      const f = await fixture();
      const initial = availabilitySchema.parse(await (await f.read()).json());
      expect(
        initial.slots.some((slot: { start: string }) =>
          slot.start.includes("T09:00"),
        ),
      ).toBe(true);
      const keys = [generateUuidV7(), generateUuidV7()];
      const responses = await Promise.all([
        f.create(0, keys[0]),
        f.create(1, keys[1]),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      const winner = responses.findIndex((response) => response.status === 201);
      const success = createdSchema.parse(await responses[winner].json());
      expect(errorSchema.parse(await responses[1 - winner].json()).code).toBe(
        "SLOT_UNAVAILABLE",
      );
      const replay = await f.create(winner, keys[winner]);
      expect(replay.status).toBe(201);
      expect(createdSchema.parse(await replay.json()).booking.id).toBe(
        success.booking.id,
      );
      const updated = availabilitySchema.parse(await (await f.read()).json());
      expect(
        updated.slots.some((slot: { start: string }) =>
          /T(08:30|09:00|09:30):/.test(slot.start),
        ),
      ).toBe(false);
      expect(
        updated.slots.some((slot: { start: string }) =>
          slot.start.includes("T10:00"),
        ),
      ).toBe(true);
      expect(
        await f.db
          .select()
          .from(bookings)
          .where(eq(bookings.barbershopId, f.shopId)),
      ).toHaveLength(1);
      const cancel = await fetch(
        `${base}/api/bookings/${success.booking.id}/cancel`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sign({ userId: f.clients[winner], credentialVersion: 0 }, process.env.JWT_SECRET ?? "slot-clock-fixture-only", { subject: f.clients[winner], expiresIn: "1h" })}`,
            "Idempotency-Key": generateUuidV7(),
          },
          body: JSON.stringify({
            expectedVersion: success.booking.version,
            scope: "PERSONAL",
          }),
        },
      );
      expect(cancel.status).toBe(200);
      const released = availabilitySchema.parse(await (await f.read()).json());
      expect(
        released.slots.some((slot: { start: string }) =>
          slot.start.includes("T09:00"),
        ),
      ).toBe(true);
      expect((await f.create(1 - winner)).status).toBe(201);
    });

    it("uses canonical instants across units and midnight, including legacy timezone data, without UTC false conflicts", async () => {
      const f = await fixture();
      const repository = new DrizzleBookingsRepository(f.db);
      const [canonical] = await f.db
        .insert(bookings)
        .values({
          barbershopId: f.shopId,
          barbermanId: f.barberId,
          customerId: f.clients[0],
          date: new Date(`${date}T00:00:00Z`),
          startTime: "09:00",
          endTime: "10:00",
          timezone: "America/Sao_Paulo",
          startsAt: new Date(`${date}T12:00:00Z`),
          endsAt: new Date(`${date}T13:00:00Z`),
          status: "CONFIRMED",
        })
        .returning();
      expect(
        await repository.findOverlapping({
          barbermanId: f.barberId,
          startAt: new Date(`${date}T09:00:00Z`),
          endAt: new Date(`${date}T10:00:00Z`),
        }),
      ).toBeNull();
      expect(
        await repository.findOverlapping({
          barbermanId: f.barberId,
          startAt: new Date(`${date}T12:30:00Z`),
          endAt: new Date(`${date}T13:30:00Z`),
        }),
      ).not.toBeNull();
      await f.db
        .update(bookings)
        .set({ startsAt: null, endsAt: null })
        .where(eq(bookings.id, canonical.id));
      expect(
        await repository.findOverlapping({
          barbermanId: f.barberId,
          startAt: new Date(`${date}T12:30:00Z`),
          endAt: new Date(`${date}T13:30:00Z`),
        }),
      ).not.toBeNull();
      await f.db
        .update(bookings)
        .set({ status: "CANCELLED" })
        .where(eq(bookings.id, canonical.id));
      expect(
        await repository.findOverlapping({
          barbermanId: f.barberId,
          startAt: new Date(`${date}T12:30:00Z`),
          endAt: new Date(`${date}T13:30:00Z`),
        }),
      ).toBeNull();
      const free = availabilitySchema.parse(await (await f.read()).json());
      expect(
        free.slots.some((slot: { start: string }) =>
          slot.start.includes("T09:00"),
        ),
      ).toBe(true);
      const otherShop = randomUUID();
      await f.db.insert(barbershops).values({
        id: otherShop,
        ownerId: f.ownerId,
        name: "Other timezone fixture",
        slug: otherShop,
        cnpj: String(++sequence).padStart(14, "0"),
        location: "Fixture address",
        timezone: "Pacific/Auckland",
        status: "ACTIVE",
      });
      await f.db.insert(bookings).values({
        barbershopId: otherShop,
        barbermanId: f.barberId,
        customerId: f.clients[0],
        date: new Date("2030-01-16T00:00:00Z"),
        startTime: "01:00",
        endTime: "02:00",
        timezone: "Pacific/Auckland",
        startsAt: new Date(`${date}T12:00:00Z`),
        endsAt: new Date(`${date}T13:00:00Z`),
        status: "IN_PROGRESS",
      });
      const busy = availabilitySchema.parse(await (await f.read()).json());
      expect(
        busy.slots.some((slot: { start: string }) =>
          slot.start.includes("T09:00"),
        ),
      ).toBe(false);
    });
  },
);
