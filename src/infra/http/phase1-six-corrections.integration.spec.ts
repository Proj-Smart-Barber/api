import { DrizzleBookingsRepository } from "../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleScheduleExceptionsRepository } from "../drizzle/repositories/drizzle-schedule-exceptions-repository";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import { sign } from "jsonwebtoken";
import { generateUuidV7 } from "../../core/security/uuidv7";
import {
  createPhase1TestDatabase,
  validatePhase1TestUrl,
} from "../../../test/helpers/isolated-phase1-db";

const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../drizzle/index", () => ({
  get db() {
    if (!fixture.db)
      throw new Error("Phase 1 test database is not initialized.");
    return fixture.db;
  },
}));

const testDbUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (testDbUrl) validatePhase1TestUrl(testDbUrl);
let db: Awaited<ReturnType<typeof createPhase1TestDatabase>>["db"];
import {
  users,
  barbershops,
  membership,
  services,
  bookings,
  barbershopSchedules,
  barbershopScheduleScopes,
  scheduleExceptions,
  barbershopLocations,
  geocodingCandidates,
  geocodingUsageBuckets,
} from "../drizzle/schema";
import { DrizzleGeocodingCandidatesRepository } from "../drizzle/repositories/drizzle-geocoding-candidates-repository";
import { DrizzleBarbershopLocationsRepository } from "../drizzle/repositories/drizzle-barbershop-locations-repository";
import { DrizzleBarbershopsRepository } from "../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../drizzle/repositories/drizzle-users-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../drizzle/services/drizzle-professional-membership-unit-of-work";
import { UpdateBarbershopLocationUseCase } from "../../domain/application/use-cases/location/update-barbershop-location/update-barbershop-location";
import { SearchGeocodingAddressUseCase } from "../../domain/application/use-cases/location/search-geocoding-address/search-geocoding-address";
import { RefreshLocationsMaintenanceUseCase } from "../../domain/application/use-cases/location/refresh-locations-maintenance/refresh-locations-maintenance";

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

const randomCnpj = () =>
  Math.floor(10000000000000 + Math.random() * 90000000000000).toString();

function makeToken(userId: string, credentialVersion = 0): string {
  return sign(
    { userId, credentialVersion },
    process.env.JWT_SECRET ?? "smartbarber-test-secret-key-12345",
    {
      subject: userId,
      expiresIn: "1h",
    },
  );
}

describe.skipIf(!testDbUrl)(
  "Phase 1 Six Audit Corrections (A1-A6) - Real HTTP & PostgreSQL Integration",
  () => {
    let server: http.Server;
    let baseUrl: string;
    let isolated:
      | Awaited<ReturnType<typeof createPhase1TestDatabase>>
      | undefined;

    const createdUserIds: string[] = [];
    const createdShopIds: string[] = [];
    const createdServiceIds: string[] = [];

    beforeAll(async () => {
      isolated = await createPhase1TestDatabase(testDbUrl!);
      db = isolated.db;
      fixture.db = db;
      vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
      vi.stubEnv("GOOGLE_GEOCODING_API_KEY", "");
      vi.stubEnv("RESEND_API_KEY", "re_test_unused_phase1");
      const { default: app } = await import("../../app.js");
      // Vitest unwraps CommonJS defaults while NodeNext retains the module type.
      server = http.createServer(app as unknown as http.RequestListener);
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
      });
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }, 90000);

    afterAll(async () => {
      try {
        if (server) {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve())),
          );
        }
      } finally {
        try {
          await isolated?.close();
        } finally {
          fixture.db = null;
          vi.unstubAllEnvs();
        }
      }
    });
    describe("A1 & A2: Jornada Geral, CUSTOM, Duração Autoritativa e Meia-Noite (HTTP + PG)", () => {
      let ownerId: string;
      let barberId: string;
      let clientId: string;
      let shopId: string;
      let service60Id: string;
      let ownerToken: string;
      let barberToken: string;
      let clientToken: string;

      beforeAll(async () => {
        ownerId = randomUUID();
        barberId = randomUUID();
        clientId = randomUUID();
        shopId = randomUUID();
        service60Id = randomUUID();

        createdUserIds.push(ownerId, barberId, clientId);
        createdShopIds.push(shopId);
        createdServiceIds.push(service60Id);

        ownerToken = makeToken(ownerId);
        barberToken = makeToken(barberId);
        clientToken = makeToken(clientId);

        await db.insert(users).values([
          {
            id: ownerId,
            name: "Owner A1",
            email: `owner_a1_${ownerId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "OWNER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: barberId,
            name: "Barber A1",
            email: `barber_a1_${barberId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "BARBER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: clientId,
            name: "Client A1",
            email: `client_a1_${clientId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "CLIENT",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
        ]);

        await db.insert(barbershops).values({
          id: shopId,
          name: "Barbearia A1 A2",
          slug: `shop-a1-a2-${shopId.slice(0, 8)}`,
          cnpj: randomCnpj(),
          location: "Rua A1, 100",
          timezone: "America/Sao_Paulo",
          ownerId,
          status: "ACTIVE",
        });

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
            userId: barberId,
            barbershopId: shopId,
            role: "BARBERMAN",
            state: "ACTIVE",
            version: 1,
          },
        ]);

        await db.insert(services).values({
          id: service60Id,
          barbershopId: shopId,
          title: "Corte Completo 60m",
          priceInCents: 7000,
          durationInMinutes: 60,
          isActive: true,
        });
      });

      it("A1: rejeita redução ou fechamento da jornada geral quando profissional ativo possui CUSTOM fora da nova janela (409 SCHEDULE_CUSTOM_CONFLICT)", async () => {
        // 1. Owner define jornada geral 09:00-18:00 na segunda-feira (MONDAY)
        const genRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
            },
            body: JSON.stringify({
              state: "CUSTOM",
              schedules: [
                { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "18:00" },
              ],
            }),
          },
        );
        expect(genRes.status).toBe(200);

        // 2. Barbeiro define jornada CUSTOM 09:00-16:00 na segunda-feira
        const barbRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules?barbermanId=${barberId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${barberToken}`,
              "Idempotency-Key": generateUuidV7(),
            },
            body: JSON.stringify({
              state: "CUSTOM",
              expectedVersion: 1,
              schedules: [
                { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "16:00" },
              ],
            }),
          },
        );
        expect(barbRes.status).toBe(200);

        // 3. Owner tenta encurtar jornada geral para 09:00-12:00 -> 409 SCHEDULE_CUSTOM_CONFLICT
        const shrinkRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
            },
            body: JSON.stringify({
              state: "CUSTOM",
              schedules: [
                { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
              ],
            }),
          },
        );
        expect(shrinkRes.status).toBe(409);
        const shrinkBody = (await shrinkRes.json()) as any;
        expect(shrinkBody.code).toBe("SCHEDULE_CUSTOM_CONFLICT");
        expect(shrinkBody.conflictingBarbers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              barbermanId: barberId,
              dayOfWeek: "MONDAY",
              openTime: "09:00",
              closeTime: "16:00",
            }),
          ]),
        );

        // 4. Owner tenta fechar a unidade (state: CLOSED) com barbeiro CUSTOM ativo -> 409 SCHEDULE_CUSTOM_CONFLICT
        const closeRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
            },
            body: JSON.stringify({
              state: "CLOSED",
              schedules: [],
            }),
          },
        );
        expect(closeRes.status).toBe(409);
        const closeBody = (await closeRes.json()) as any;
        expect(closeBody.code).toBe("SCHEDULE_CUSTOM_CONFLICT");

        // 5. Verificar que a leitura da jornada do barbeiro preserva 09:00-16:00 intacto
        const getBarberRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules?barbermanId=${barberId}`,
          {
            headers: { Authorization: `Bearer ${barberToken}` },
          },
        );
        expect(getBarberRes.status).toBe(200);
        const getBarberBody = (await getBarberRes.json()) as any;
        expect(getBarberBody.schedules[0].closeTime).toBe("16:00");
        expect(getBarberBody.effectiveSchedules[0].closeTime).toBe("16:00");
      });

      it("A1: aceita CUSTOM contínuo sobre turnos contíguos da unidade (09:00-10:00 + 10:00-12:00) e fecha disponibilidade quando unidade está CLOSED", async () => {
        // Barbeiro volta para INHERIT para permitir ajuste geral
        const inheritRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules?barbermanId=${barberId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${barberToken}`,
              "Idempotency-Key": generateUuidV7(),
            },
            body: JSON.stringify({
              state: "INHERIT",
              expectedVersion: 2,
              schedules: [],
            }),
          },
        );
        expect(inheritRes.status).toBe(200);

        // Owner define dois turnos contíguos na segunda (09:00-10:00 e 10:00-12:00)
        const contiguousGenRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
            },
            body: JSON.stringify({
              state: "CUSTOM",
              schedules: [
                { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "10:00" },
                { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "12:00" },
              ],
            }),
          },
        );
        expect(contiguousGenRes.status).toBe(200);

        // Barbeiro define CUSTOM contínuo 09:00-12:00 -> 200 OK
        const contiguousBarberRes = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/schedules?barbermanId=${barberId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${barberToken}`,
              "Idempotency-Key": generateUuidV7(),
            },
            body: JSON.stringify({
              state: "CUSTOM",
              expectedVersion: 3,
              schedules: [
                { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
              ],
            }),
          },
        );
        expect(contiguousBarberRes.status).toBe(200);
      });

      it("A2: rejeita agendamento que excede fechamento usando duração autoritativa do serviço, com ou sem endTime forjado", async () => {
        // 2030-01-07 é uma segunda-feira (MONDAY), janela efetiva é 09:00-12:00 e serviço dura 60min
        const futureMonday = "2030-01-07";

        // 1. Cliente envia startTime 11:30 e endTime forjado 11:31 -> 409 SLOT_UNAVAILABLE
        const forgedBookingRes = await fetch(`${baseUrl}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          body: JSON.stringify({
            barbermanId: barberId,
            serviceId: service60Id,
            date: futureMonday,
            startTime: "11:30",
            endTime: "11:31",
          }),
        });
        expect(forgedBookingRes.status).toBe(409);
        const forgedBookingBody = (await forgedBookingRes.json()) as any;
        expect(forgedBookingBody.code).toBe("SLOT_UNAVAILABLE");

        // 2. Cliente envia startTime 11:30 sem endTime -> 409 SLOT_UNAVAILABLE (11:30 + 60m = 12:30 > 12:00)
        const unalignedBookingRes = await fetch(`${baseUrl}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          body: JSON.stringify({
            barbermanId: barberId,
            serviceId: service60Id,
            date: futureMonday,
            startTime: "11:30",
          }),
        });
        expect(unalignedBookingRes.status).toBe(409);

        // Verificar zero reservas criadas no banco
        const persistedBookings = await db
          .select()
          .from(bookings)
          .where(eq(bookings.barbershopId, shopId));
        expect(persistedBookings).toHaveLength(0);

        // 3. Cliente envia startTime 11:00 (11:00 + 60m = 12:00 <= 12:00) -> 201 Created com endTime 12:00
        const validBookingRes = await fetch(`${baseUrl}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          body: JSON.stringify({
            barbermanId: barberId,
            serviceId: service60Id,
            date: futureMonday,
            startTime: "11:00",
          }),
        });
        expect(validBookingRes.status).toBe(201);
        const validBookingBody = (await validBookingRes.json()) as any;
        expect(validBookingBody.booking.endTime).toBe("12:00");
      });
      it("B3: cria, altera e exclui exceção por HTTP sem lock cruzado e bloqueia reserva na janela", async () => {
        const route = `${baseUrl}/api/barbershops/${shopId}/schedule-exceptions`;
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        };
        const created = await fetch(route, {
          method: "POST",
          headers,
          body: JSON.stringify({
            date: "2031-01-06",
            startTime: "09:00",
            endTime: "10:00",
          }),
        });
        expect(created.status).toBe(201);
        const { exceptionId } = (await created.json()) as {
          exceptionId: string;
        };
        const blocked = await fetch(`${baseUrl}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          body: JSON.stringify({
            barbermanId: barberId,
            serviceId: service60Id,
            date: "2031-01-06",
            startTime: "09:00",
          }),
        });
        expect(blocked.status).toBe(409);
        const invalid = await fetch(`${route}/${exceptionId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ startTime: "11:00", endTime: "10:00" }),
        });
        expect(invalid.status).toBe(400);
        let rows = await db
          .select()
          .from(scheduleExceptions)
          .where(eq(scheduleExceptions.id, exceptionId));
        expect(rows[0].startTime).toBe("09:00");
        const updated = await fetch(`${route}/${exceptionId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ startTime: "10:00", endTime: "11:00" }),
        });
        expect(updated.status).toBe(200);
        rows = await db
          .select()
          .from(scheduleExceptions)
          .where(eq(scheduleExceptions.id, exceptionId));
        expect(rows[0].startTime).toBe("10:00");
        const removed = await fetch(`${route}/${exceptionId}`, {
          method: "DELETE",
          headers,
        });
        expect(removed.status).toBe(204);
        expect(
          await db
            .select()
            .from(scheduleExceptions)
            .where(eq(scheduleExceptions.id, exceptionId)),
        ).toHaveLength(0);
      });

      it("B3: falha após INSERT reverte a exceção na mesma transação", async () => {
        const original = DrizzleScheduleExceptionsRepository.prototype.create;
        const write = vi
          .spyOn(DrizzleScheduleExceptionsRepository.prototype, "create")
          .mockImplementationOnce(async function (
            this: DrizzleScheduleExceptionsRepository,
            exception,
            tx,
          ) {
            expect(tx).toBeDefined();
            await original.call(this, exception, tx);
            throw new Error("Synthetic failure after exception INSERT");
          });
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          const failed = await fetch(
            `${baseUrl}/api/barbershops/${shopId}/schedule-exceptions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${ownerToken}`,
              },
              body: JSON.stringify({
                date: "2031-01-07",
                reason: "rollback-fixture",
              }),
            },
          );
          expect(failed.status).toBe(500);
          expect(
            await db
              .select()
              .from(scheduleExceptions)
              .where(
                and(
                  eq(scheduleExceptions.barbershopId, shopId),
                  eq(scheduleExceptions.reason, "rollback-fixture"),
                ),
              ),
          ).toHaveLength(0);
        } finally {
          write.mockRestore();
          errors.mockRestore();
        }
      });
    });

    describe("A3, A4, A5 & A6: Localização Transacional, Rollback de Corrida, Quotas Exatas e Geocodificação (HTTP + PG)", () => {
      let ownerId: string;
      let inactiveOwnerId: string;
      let pureClientId: string;
      let onboardingOwnerId: string;
      let shopAId: string;
      let shopBId: string;
      let inactiveOwnerShopId: string;

      let ownerToken: string;
      let inactiveOwnerToken: string;
      let pureClientToken: string;
      let onboardingOwnerToken: string;

      beforeAll(async () => {
        ownerId = randomUUID();
        inactiveOwnerId = randomUUID();
        pureClientId = randomUUID();
        onboardingOwnerId = randomUUID();
        shopAId = randomUUID();
        shopBId = randomUUID();
        inactiveOwnerShopId = randomUUID();

        createdUserIds.push(
          ownerId,
          inactiveOwnerId,
          pureClientId,
          onboardingOwnerId,
        );
        createdShopIds.push(shopAId, shopBId, inactiveOwnerShopId);

        ownerToken = makeToken(ownerId);
        inactiveOwnerToken = makeToken(inactiveOwnerId);
        pureClientToken = makeToken(pureClientId);
        onboardingOwnerToken = makeToken(onboardingOwnerId);

        await db.insert(users).values([
          {
            id: ownerId,
            name: "Owner Location",
            email: `owner_loc_${ownerId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "OWNER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: inactiveOwnerId,
            name: "Inactive Owner Location",
            email: `inact_loc_${inactiveOwnerId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "OWNER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: pureClientId,
            name: "Pure Client Location",
            email: `client_loc_${pureClientId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "CLIENT",
            onboardingIntent: "CLIENT",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: onboardingOwnerId,
            name: "Onboarding Owner",
            email: `onb_loc_${onboardingOwnerId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "CLIENT",
            onboardingIntent: "OWNER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
        ]);

        await db.insert(barbershops).values([
          {
            id: shopAId,
            name: "Shop Location A",
            slug: `shop-loc-a-${shopAId.slice(0, 8)}`,
            cnpj: randomCnpj(),
            location: "Endereço Antigo A",
            timezone: "America/Sao_Paulo",
            ownerId,
            status: "ACTIVE",
          },
          {
            id: shopBId,
            name: "Shop Location B",
            slug: `shop-loc-b-${shopBId.slice(0, 8)}`,
            cnpj: randomCnpj(),
            location: "Endereço Antigo B",
            timezone: "America/Sao_Paulo",
            ownerId,
            status: "ACTIVE",
          },
          {
            id: inactiveOwnerShopId,
            name: "Shop Inactive Owner",
            slug: `shop-loc-inact-${inactiveOwnerShopId.slice(0, 8)}`,
            cnpj: randomCnpj(),
            location: "Endereço Inativo",
            timezone: "America/Sao_Paulo",
            ownerId: inactiveOwnerId,
            status: "ACTIVE",
          },
        ]);

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
            userId: inactiveOwnerId,
            barbershopId: inactiveOwnerShopId,
            role: "OWNER",
            state: "INACTIVE",
            version: 1,
          },
        ]);

        await db.insert(barbershopLocations).values([
          {
            barbershopId: shopAId,
            status: "CONFIRMED",
            latitude: -23.5,
            longitude: -46.6,
            source: "GOOGLE",
            version: 1,
            confirmedAt: new Date(),
            acquiredAt: new Date(),
            validUntil: new Date(Date.now() + 86400000),
            pinAdjusted: false,
          },
          {
            barbershopId: shopBId,
            status: "CONFIRMED",
            latitude: -23.5,
            longitude: -46.6,
            source: "GOOGLE",
            version: 1,
            confirmedAt: new Date(),
            acquiredAt: new Date(),
            validUntil: new Date(Date.now() + 86400000),
            pinAdjusted: false,
          },
        ]);
      });

      it("A3 & A6: PATCH /api/barbershops/:shopId/location aceita displayAddress formatado pelo Google e retorna estado idêntico ao commitado no PostgreSQL", async () => {
        const searchedQuery = "av paulista 1578";
        const googleFormatted =
          "Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brasil";
        const queryHash = createHash("sha256")
          .update(searchedQuery.toLowerCase())
          .digest("hex");
        const formattedHash = createHash("sha256")
          .update(googleFormatted.toLowerCase())
          .digest("hex");

        const candidateId = randomUUID();
        await db.insert(geocodingCandidates).values({
          id: candidateId,
          actorId: ownerId,
          barbershopId: shopAId,
          addressHash: `${queryHash}:${formattedHash}`,
          latitude: -23.561414,
          longitude: -46.6558819,
          placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });

        const mutationId = generateUuidV7();
        const patchRes = await fetch(
          `${baseUrl}/api/barbershops/${shopAId}/location`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
              "Idempotency-Key": mutationId,
            },
            body: JSON.stringify({
              address: googleFormatted,
              candidateId,
              latitude: -23.561414,
              longitude: -46.6558819,
              expectedVersion: 1,
            }),
          },
        );

        expect(patchRes.status).toBe(200);
        const patchBody = (await patchRes.json()) as any;
        expect(patchBody.version).toBe(2);
        expect(patchBody.address).toBe(googleFormatted);
        expect(patchBody.point).toEqual({
          latitude: -23.561414,
          longitude: -46.6558819,
        });

        // Conferir no banco que estado retornado == estado commitado
        const [dbLoc] = await db
          .select()
          .from(barbershopLocations)
          .where(eq(barbershopLocations.barbershopId, shopAId));
        const [dbShop] = await db
          .select()
          .from(barbershops)
          .where(eq(barbershops.id, shopAId));

        expect(dbLoc.version).toBe(2);
        expect(dbShop.location).toBe(googleFormatted);

        // Replay idempotente retorna exatamente version 2
        const replayRes = await fetch(
          `${baseUrl}/api/barbershops/${shopAId}/location`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
              "Idempotency-Key": mutationId,
            },
            body: JSON.stringify({
              address: googleFormatted,
              candidateId,
              latitude: -23.561414,
              longitude: -46.6558819,
              expectedVersion: 1,
            }),
          },
        );
        expect(replayRes.status).toBe(200);
        const replayBody = (await replayRes.json()) as any;
        expect(replayBody.version).toBe(2);
        expect(replayBody.address).toBe(googleFormatted);
      });

      it("A4: disputa concorrente pelo mesmo candidateId entre duas unidades faz rollback completo da operação perdedora no PostgreSQL", async () => {
        // Resetar shopAId para version 1 para o teste de corrida
        await db
          .update(barbershopLocations)
          .set({ version: 1, lastMutationId: null })
          .where(eq(barbershopLocations.barbershopId, shopAId));
        await db
          .update(barbershops)
          .set({ location: "Endereço Antes da Corrida A" })
          .where(eq(barbershops.id, shopAId));
        await db
          .update(barbershops)
          .set({ location: "Endereço Antes da Corrida B" })
          .where(eq(barbershops.id, shopBId));

        const raceAddress = "Rua da Corrida Concorrente, 500";
        const raceHash = createHash("sha256")
          .update(raceAddress.toLowerCase())
          .digest("hex");
        const sharedCandidateId = randomUUID();

        await db.insert(geocodingCandidates).values({
          id: sharedCandidateId,
          actorId: ownerId,
          barbershopId: null,
          addressHash: raceHash,
          latitude: -23.55052,
          longitude: -46.633308,
          placeId: "ChIJ-race-shared",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });

        const [resA, resB] = await Promise.all([
          fetch(`${baseUrl}/api/barbershops/${shopAId}/location`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
              "Idempotency-Key": generateUuidV7(),
            },
            body: JSON.stringify({
              address: raceAddress,
              candidateId: sharedCandidateId,
              latitude: -23.55052,
              longitude: -46.633308,
              expectedVersion: 1,
            }),
          }),
          fetch(`${baseUrl}/api/barbershops/${shopBId}/location`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ownerToken}`,
              "Idempotency-Key": generateUuidV7(),
            },
            body: JSON.stringify({
              address: raceAddress,
              candidateId: sharedCandidateId,
              latitude: -23.55052,
              longitude: -46.633308,
              expectedVersion: 1,
            }),
          }),
        ]);

        const statuses = [resA.status, resB.status].sort();
        expect(statuses).toEqual([200, 400]);

        const locs = await db
          .select()
          .from(barbershopLocations)
          .where(inArray(barbershopLocations.barbershopId, [shopAId, shopBId]));
        const versions = locs.map((l) => l.version).sort();
        expect(versions).toEqual([1, 2]);

        const shops = await db
          .select()
          .from(barbershops)
          .where(inArray(barbershops.id, [shopAId, shopBId]));
        const winningShops = shops.filter((s) => s.location === raceAddress);
        const rolledBackShops = shops.filter((s) =>
          s.location.startsWith("Endereço Antes da Corrida"),
        );
        expect(winningShops).toHaveLength(1);
        expect(rolledBackShops).toHaveLength(1);
      });

      it("A5: quotas PostgreSQL de geocodificação isolam pares exatos (windowType, windowStart) e respeitam concorrência", async () => {
        const quotaActorId = randomUUID();
        createdUserIds.push(quotaActorId);
        await db.insert(users).values({
          id: quotaActorId,
          name: "Quota Actor",
          email: `quota_${quotaActorId.slice(0, 8)}@test.com`,
          password: "hash",
          cpf: generateValidCpf(),
          accountType: "OWNER",
          credentialVersion: 0,
          emailVerifiedAt: new Date(),
        });

        const candidatesRepo = new DrizzleGeocodingCandidatesRepository(db);

        const now = new Date();
        const dayStart = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
        const otherHourStart =
          now.getUTCHours() === 0
            ? new Date(dayStart.getTime() - 3600000)
            : dayStart;
        const currentHourStart = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            0,
            0,
            0,
          ),
        );

        // Semear 30 chamadas em outra hora (ex.: 00:00 UTC) e 30 no dia
        await db.insert(geocodingUsageBuckets).values([
          {
            id: randomUUID(),
            scope: "ACTOR",
            scopeId: quotaActorId,
            windowType: "HOURLY",
            windowStart: otherHourStart,
            count: 30,
            expiresAt: new Date(otherHourStart.getTime() + 2 * 3600000),
          },
          {
            id: randomUUID(),
            scope: "ACTOR",
            scopeId: quotaActorId,
            windowType: "DAILY",
            windowStart: dayStart,
            count: 30,
            expiresAt: new Date(dayStart.getTime() + 25 * 3600000),
          },
        ]);

        // 1. Chamada na hora atual deve ser permitida porque a hora atual tem 0 requisições
        const allowed = await candidatesRepo.checkAndIncrementUsage(
          quotaActorId,
          30,
          100,
        );
        expect(allowed).toBe(true);

        // Conferir que o bucket de outra hora continua em 30, a hora atual foi para 1 e o dia foi para 31
        const bucketsAfter1 = await db
          .select()
          .from(geocodingUsageBuckets)
          .where(eq(geocodingUsageBuckets.scopeId, quotaActorId));

        const otherHourBucket = bucketsAfter1.find(
          (b) =>
            b.windowType === "HOURLY" &&
            b.windowStart.getTime() === otherHourStart.getTime(),
        );
        const currentHourBucket = bucketsAfter1.find(
          (b) =>
            b.windowType === "HOURLY" &&
            b.windowStart.getTime() === currentHourStart.getTime(),
        );
        const dayBucket = bucketsAfter1.find(
          (b) =>
            b.windowType === "DAILY" &&
            b.windowStart.getTime() === dayStart.getTime(),
        );

        expect(otherHourBucket?.count).toBe(30);
        expect(currentHourBucket?.count).toBe(1);
        expect(dayBucket?.count).toBe(31);

        // 2. Ajustar hora atual para 28 e disparar 10 requisições concorrentes -> exatamente 2 passam e 8 bloqueiam
        await db
          .update(geocodingUsageBuckets)
          .set({ count: 28 })
          .where(eq(geocodingUsageBuckets.id, currentHourBucket!.id));

        const concurrentResults = await Promise.all(
          Array.from({ length: 10 }, () =>
            candidatesRepo.checkAndIncrementUsage(quotaActorId, 30, 100),
          ),
        );
        const passedCount = concurrentResults.filter(Boolean).length;
        const blockedCount = concurrentResults.filter((r) => !r).length;
        expect(passedCount).toBe(2);
        expect(blockedCount).toBe(8);

        const [finalHourBucket] = await db
          .select()
          .from(geocodingUsageBuckets)
          .where(eq(geocodingUsageBuckets.id, currentHourBucket!.id));
        expect(finalHourBucket.count).toBe(30);
      });

      it("A6: bloqueia CLIENT sem onboarding, bloqueia OWNER INACTIVE, aceita onboarding OWNER verificado e retorna 503 sem chave Google", async () => {
        // 1. CLIENT sem barbearia e sem onboardingIntent OWNER -> 403 FORBIDDEN e 0 uso de quota
        const clientRes = await fetch(`${baseUrl}/api/geocoding/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pureClientToken}`,
          },
          body: JSON.stringify({ address: "Avenida Paulista, 1000" }),
        });
        expect(clientRes.status).toBe(403);

        const clientBuckets = await db
          .select()
          .from(geocodingUsageBuckets)
          .where(eq(geocodingUsageBuckets.scopeId, pureClientId));
        expect(clientBuckets).toHaveLength(0);

        // 2. OWNER com membership INACTIVE -> 403 em POST /api/geocoding/search e 403 em GET /api/barbershops/:shopId/location
        const inactSearchRes = await fetch(`${baseUrl}/api/geocoding/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${inactiveOwnerToken}`,
          },
          body: JSON.stringify({
            address: "Avenida Paulista, 1000",
            shopId: inactiveOwnerShopId,
          }),
        });
        expect(inactSearchRes.status).toBe(403);

        const inactGetLocRes = await fetch(
          `${baseUrl}/api/barbershops/${inactiveOwnerShopId}/location`,
          {
            headers: { Authorization: `Bearer ${inactiveOwnerToken}` },
          },
        );
        expect(inactGetLocRes.status).toBe(403);

        // 3. Usuário elegível ao onboarding de OWNER (emailVerifiedAt != null e onboardingIntent = OWNER) passa na autorização;
        // como GOOGLE_MAPS_API_KEY não está configurada no ambiente de teste, deve retornar 503 LOCATION_SERVICE_UNAVAILABLE (e não 400!)
        const prevKey = process.env.GOOGLE_MAPS_API_KEY;
        delete process.env.GOOGLE_MAPS_API_KEY;
        try {
          const onbRes = await fetch(`${baseUrl}/api/geocoding/search`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${onboardingOwnerToken}`,
            },
            body: JSON.stringify({ address: "Avenida Paulista, 1000" }),
          });
          expect(onbRes.status).toBe(503);
          const onbBody = (await onbRes.json()) as any;
          expect(onbBody.code).toBe("LOCATION_SERVICE_UNAVAILABLE");
        } finally {
          if (prevKey !== undefined) {
            process.env.GOOGLE_MAPS_API_KEY = prevKey;
          }
        }
      });
    });

    describe("Complementar: Próximo Atendimento (endsAt > now) e Manutenção de Localizações (PG)", () => {
      it("exclui reserva IN_PROGRESS já encerrada (endsAt <= now) em GET /api/bookings/me?view=upcoming&limit=1", async () => {
        const custId = randomUUID();
        const barbId = randomUUID();
        const ownerId = randomUUID();
        const shopId = randomUUID();
        createdUserIds.push(custId, barbId, ownerId);
        createdShopIds.push(shopId);

        const custToken = makeToken(custId);

        await db.insert(users).values([
          {
            id: custId,
            name: "Customer Upcoming",
            email: `cust_up_${custId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "CLIENT",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: barbId,
            name: "Barber Upcoming",
            email: `barb_up_${barbId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "BARBER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
          {
            id: ownerId,
            name: "Owner Upcoming",
            email: `own_up_${ownerId.slice(0, 8)}@test.com`,
            password: "hash",
            cpf: generateValidCpf(),
            accountType: "OWNER",
            credentialVersion: 0,
            emailVerifiedAt: new Date(),
          },
        ]);

        await db.insert(barbershops).values({
          id: shopId,
          name: "Shop Upcoming",
          slug: `shop-up-${shopId.slice(0, 8)}`,
          cnpj: randomCnpj(),
          location: "Rua Upcoming, 10",
          timezone: "America/Sao_Paulo",
          ownerId,
          status: "ACTIVE",
        });

        const now = new Date();
        const staleInProgressId = randomUUID();
        const activeUpcomingId = randomUUID();
        const unknownPastId = randomUUID();
        const unknownFutureId = randomUUID();

        await db.insert(bookings).values([
          {
            id: unknownPastId,
            barbershopId: shopId,
            barbermanId: barbId,
            customerId: custId,
            startsAt: new Date(now.getTime() - 10 * 60000),
            endsAt: null,
            date: now,
            startTime: "10:00",
            endTime: "10:30",
            status: "CONFIRMED",
            totalPriceInCents: null,
            totalDurationInMinutes: null,
          },
          {
            id: unknownFutureId,
            barbershopId: shopId,
            barbermanId: barbId,
            customerId: custId,
            startsAt: new Date(now.getTime() + 4 * 3600000),
            endsAt: null,
            date: now,
            startTime: "18:00",
            endTime: "18:30",
            status: "CONFIRMED",
            totalPriceInCents: null,
            totalDurationInMinutes: null,
          },
          {
            id: staleInProgressId,
            barbershopId: shopId,
            barbermanId: barbId,
            customerId: custId,
            startsAt: new Date(now.getTime() - 3 * 3600000),
            endsAt: new Date(now.getTime() - 2 * 3600000), // já terminou há 2 horas!
            date: now,
            startTime: "10:00",
            endTime: "11:00",
            status: "IN_PROGRESS",
            totalPriceInCents: 5000,
            totalDurationInMinutes: 60,
          },
          {
            id: activeUpcomingId,
            barbershopId: shopId,
            barbermanId: barbId,
            customerId: custId,
            startsAt: new Date(now.getTime() + 2 * 3600000),
            endsAt: new Date(now.getTime() + 3 * 3600000),
            date: now,
            startTime: "15:00",
            endTime: "16:00",
            status: "CONFIRMED",
            totalPriceInCents: 5000,
            totalDurationInMinutes: 60,
          },
        ]);

        const res = await fetch(
          `${baseUrl}/api/bookings/me?view=upcoming&limit=1`,
          {
            headers: { Authorization: `Bearer ${custToken}` },
          },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.bookings).toHaveLength(1);
        expect(body.bookings[0].id).toBe(activeUpcomingId);
        const page = await fetch(
          `${baseUrl}/api/bookings/me?view=upcoming&limit=2`,
          {
            headers: { Authorization: `Bearer ${custToken}` },
          },
        );
        expect(page.status).toBe(200);
        const loaded = (await page.json()) as {
          bookings: Array<{ id: string; totalPriceInCents: number | null }>;
        };
        expect(loaded.bookings.map((booking) => booking.id)).toEqual([
          activeUpcomingId,
          unknownFutureId,
        ]);
        expect(loaded.bookings[1].totalPriceInCents).toBeNull();
        const readDetails = DrizzleBookingsRepository.prototype.getDetails;
        const concurrentChange = vi
          .spyOn(DrizzleBookingsRepository.prototype, "getDetails")
          .mockImplementationOnce(async function (
            this: DrizzleBookingsRepository,
            id,
            tx,
          ) {
            expect(id).toBe(activeUpcomingId);
            await db
              .update(bookings)
              .set({ status: "CANCELLED" })
              .where(eq(bookings.id, id));
            return readDetails.call(this, id, tx);
          });
        try {
          const snapshot = await fetch(
            `${baseUrl}/api/bookings/me?view=upcoming&limit=1`,
            {
              headers: { Authorization: `Bearer ${custToken}` },
            },
          );
          expect(snapshot.status).toBe(200);
          const result = (await snapshot.json()) as {
            bookings: Array<{ id: string; status: string }>;
          };
          expect(result.bookings[0].id).toBe(activeUpcomingId);
          expect(result.bookings[0].status).toBe("CONFIRMED");
        } finally {
          concurrentChange.mockRestore();
        }
        const refreshed = await fetch(
          `${baseUrl}/api/bookings/me?view=upcoming&limit=1`,
          {
            headers: { Authorization: `Bearer ${custToken}` },
          },
        );
        expect(refreshed.status).toBe(200);
        const result = (await refreshed.json()) as {
          bookings: Array<{ id: string }>;
        };
        expect(result.bookings[0].id).toBe(unknownFutureId);
      });

      it("RefreshLocationsMaintenanceUseCase expira apenas pontos GOOGLE realmente vencidos sem sobrescrever localização recém-confirmada", async () => {
        const ownerId = randomUUID();
        const staleShopId = randomUUID();
        const freshShopId = randomUUID();
        createdUserIds.push(ownerId);
        createdShopIds.push(staleShopId, freshShopId);

        await db.insert(users).values({
          id: ownerId,
          name: "Owner Maint",
          email: `own_maint_${ownerId.slice(0, 8)}@test.com`,
          password: "hash",
          cpf: generateValidCpf(),
          accountType: "OWNER",
          credentialVersion: 0,
          emailVerifiedAt: new Date(),
        });

        await db.insert(barbershops).values([
          {
            id: staleShopId,
            name: "Shop Stale Maint",
            slug: `shop-stale-m-${staleShopId.slice(0, 8)}`,
            cnpj: randomCnpj(),
            location: "Rua Stale",
            timezone: "America/Sao_Paulo",
            ownerId,
            status: "ACTIVE",
          },
          {
            id: freshShopId,
            name: "Shop Fresh Maint",
            slug: `shop-fresh-m-${freshShopId.slice(0, 8)}`,
            cnpj: randomCnpj(),
            location: "Rua Fresh",
            timezone: "America/Sao_Paulo",
            ownerId,
            status: "ACTIVE",
          },
        ]);

        await db.insert(barbershopLocations).values([
          {
            barbershopId: staleShopId,
            status: "CONFIRMED",
            latitude: -23.5,
            longitude: -46.6,
            source: "GOOGLE",
            version: 1,
            confirmedAt: new Date(Date.now() - 40 * 86400000),
            acquiredAt: new Date(Date.now() - 40 * 86400000),
            validUntil: new Date(Date.now() - 86400000), // vencido ontem
            pinAdjusted: false,
          },
          {
            barbershopId: freshShopId,
            status: "CONFIRMED",
            latitude: -23.5,
            longitude: -46.6,
            source: "GOOGLE",
            version: 1,
            confirmedAt: new Date(),
            acquiredAt: new Date(),
            validUntil: new Date(Date.now() + 20 * 86400000), // válido por 20 dias
            pinAdjusted: false,
          },
        ]);

        const candidatesRepo = new DrizzleGeocodingCandidatesRepository(db);
        const maintUseCase = new RefreshLocationsMaintenanceUseCase(
          candidatesRepo,
          db,
        );
        const res = await maintUseCase.execute();
        expect(res.isRight()).toBe(true);

        const [staleAfter] = await db
          .select()
          .from(barbershopLocations)
          .where(eq(barbershopLocations.barbershopId, staleShopId));
        const [freshAfter] = await db
          .select()
          .from(barbershopLocations)
          .where(eq(barbershopLocations.barbershopId, freshShopId));

        expect(staleAfter.status).toBe("NEEDS_REVIEW");
        expect(staleAfter.latitude).toBeNull();
        expect(staleAfter.longitude).toBeNull();
        expect(freshAfter.status).toBe("CONFIRMED");
        expect(freshAfter.latitude).toBe(-23.5);
      });
    });
  },
);
