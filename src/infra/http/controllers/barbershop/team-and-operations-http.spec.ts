import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { sign } from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../../../app";
import { env } from "../../../env";
import { db } from "../../../drizzle";
import {
  barbershops,
  bookings,
  membership,
  operationAttempts,
  users,
} from "../../../drizzle/schema";

describe("Team & Idempotent Operations HTTP Endpoints (E2E)", () => {
  let server: http.Server;
  let baseUrl: string;

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();

  let ownerUserId: string;
  let staffUserId: string;
  let outsiderUserId: string;

  let ownerToken: string;
  let staffToken: string;
  let outsiderToken: string;

  let shopId: string;
  let ownerMembershipId: string;
  let staffMembershipId: string;
  let createdBookingId: string | null = null;

  beforeAll(async () => {
    // Inicializar servidor Express em porta efêmera
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // Criar usuários de teste
    ownerUserId = randomUUID();
    await db.insert(users).values({
      id: ownerUserId,
      name: "Proprietário Barbershop",
      email: `owner.http.${ownerUserId.slice(0, 8)}@example.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "OWNER",
      credentialVersion: 0,
      emailVerifiedAt: new Date(),
    });

    staffUserId = randomUUID();
    await db.insert(users).values({
      id: staffUserId,
      name: "Barbeiro Staff",
      email: `staff.http.${staffUserId.slice(0, 8)}@example.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "BARBER",
      credentialVersion: 0,
      emailVerifiedAt: new Date(),
    });

    outsiderUserId = randomUUID();
    await db.insert(users).values({
      id: outsiderUserId,
      name: "Outsider User",
      email: `outsider.http.${outsiderUserId.slice(0, 8)}@example.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "CLIENT",
      credentialVersion: 0,
      emailVerifiedAt: new Date(),
    });

    ownerToken = sign({ sub: ownerUserId, version: 0 }, env.JWT_SECRET);
    staffToken = sign({ sub: staffUserId, version: 0 }, env.JWT_SECRET);
    outsiderToken = sign({ sub: outsiderUserId, version: 0 }, env.JWT_SECRET);

    // Criar Barbearia
    shopId = randomUUID();
    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia HTTP Test",
      ownerId: ownerUserId,
      slug: `shop-http-${shopId.slice(0, 8)}`,
      cnpj: `${shopId.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}`,
      location: "Avenida Central, 100",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    // Vínculo do Proprietário
    ownerMembershipId = randomUUID();
    await db.insert(membership).values({
      id: ownerMembershipId,
      barbershopId: shopId,
      userId: ownerUserId,
      role: "OWNER",
      state: "ACTIVE",
      version: 1,
    });

    // Vínculo do Barbeiro
    staffMembershipId = randomUUID();
    await db.insert(membership).values({
      id: staffMembershipId,
      barbershopId: shopId,
      userId: staffUserId,
      role: "BARBERMAN",
      state: "ACTIVE",
      version: 1,
    });
  });

  afterAll(async () => {
    try {
      if (createdBookingId) {
        await db.delete(bookings).where(eq(bookings.id, createdBookingId));
      }
      await db
        .delete(operationAttempts)
        .where(eq(operationAttempts.actorId, ownerUserId));
      await db.delete(membership).where(eq(membership.barbershopId, shopId));
      await db.delete(barbershops).where(eq(barbershops.id, shopId));
      await db.delete(users).where(eq(users.id, ownerUserId));
      await db.delete(users).where(eq(users.id, staffUserId));
      await db.delete(users).where(eq(users.id, outsiderUserId));
    } catch {
      // ignore
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe("GET /api/barbershops/:shopId/team", () => {
    it("deve retornar 401 se nenhum token for fornecido", async () => {
      const response = await fetch(`${baseUrl}/api/barbershops/${shopId}/team`);
      expect(response.status).toBe(401);
    });

    it("deve retornar 403 se um usuário de fora (não-proprietário) tentar listar a equipe", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team`,
        {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        },
      );
      expect(response.status).toBe(403);
    });

    it("deve retornar 403 se o barbeiro da unidade (não-proprietário) tentar listar a equipe privada", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team`,
        {
          headers: { Authorization: `Bearer ${staffToken}` },
        },
      );
      expect(response.status).toBe(403);
    });

    it("deve retornar 200 com a equipe paginada e versionamento para o proprietário", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team?page=1&limit=10`,
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("total");
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      expect(data.members.length).toBeGreaterThanOrEqual(2);

      const staffMember = data.members.find(
        (m: { membershipId: string }) => m.membershipId === staffMembershipId,
      );
      expect(staffMember).toBeDefined();
      expect(staffMember.name).toBe("Barbeiro Staff");
      expect(staffMember.state).toBe("ACTIVE");
      expect(staffMember.version).toBe(1);
      expect(staffMember.endedAt).toBeNull();
    });
  });

  describe("PATCH /api/barbershops/:shopId/team/:membershipId/deactivation", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team/${staffMembershipId}/deactivation`,
        { method: "PATCH" },
      );
      expect(response.status).toBe(401);
    });

    it("deve retornar 403 se solicitado por não proprietário", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team/${staffMembershipId}/deactivation`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${staffToken}` },
        },
      );
      expect(response.status).toBe(403);
    });

    it("deve retornar 400 se o proprietário tentar desativar o próprio vínculo de owner", async () => {
      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team/${ownerMembershipId}/deactivation`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.message).toMatch(/proprietário|ownership|si mesmo/i);
    });

    it("deve retornar 409 se o barbeiro possuir agendamento futuro", async () => {
      createdBookingId = randomUUID();
      const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

      await db.insert(bookings).values({
        id: createdBookingId,
        barbershopId: shopId,
        barbermanId: staffUserId,
        customerId: outsiderUserId,
        startsAt,
        endsAt,
        date: new Date("2026-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "CONFIRMED",
        version: 1,
      });

      try {
        const response = await fetch(
          `${baseUrl}/api/barbershops/${shopId}/team/${staffMembershipId}/deactivation`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${ownerToken}` },
          },
        );

        expect(response.status).toBe(409);
        const data = (await response.json()) as any;
        expect(data.message).toMatch(/agendamentos|atendimentos/i);
      } finally {
        // Limpar o agendamento para liberar a desativação nos próximos testes
        if (createdBookingId) {
          await db.delete(bookings).where(eq(bookings.id, createdBookingId));
          createdBookingId = null;
        }
      }
    });

    it("deve desativar com sucesso e registrar operação no ledger idempotente", async () => {
      const requestId = "req-http-idemp-001";

      const response = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team/${staffMembershipId}/deactivation`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            "Idempotency-Key": requestId,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.membershipId).toBe(staffMembershipId);
      expect(data.state).toBe("INACTIVE");
      expect(data.version).toBe(2);
      expect(data.endedAt).toBeDefined();

      // Verificar que o membership agora está INACTIVE no banco
      const [updatedMembership] = await db
        .select()
        .from(membership)
        .where(eq(membership.id, staffMembershipId));
      expect(updatedMembership?.state).toBe("INACTIVE");
      expect(updatedMembership?.version).toBe(2);

      // Replay da requisição com a mesma Idempotency-Key
      const replayResponse = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team/${staffMembershipId}/deactivation`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            "Idempotency-Key": requestId,
          },
        },
      );

      expect(replayResponse.status).toBe(200);
      const replayData = await replayResponse.json();
      expect(replayData).toEqual(data);
    });
  });

  describe("GET /api/operation-attempts/:requestId", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await fetch(
        `${baseUrl}/api/operation-attempts/req-http-idemp-001`,
      );
      expect(response.status).toBe(401);
    });

    it("deve retornar 404 para ator diferente do autor da operação", async () => {
      const response = await fetch(
        `${baseUrl}/api/operation-attempts/req-http-idemp-001`,
        {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        },
      );
      expect(response.status).toBe(404);
    });

    it("deve retornar 200 com os dados da tentativa e header Cache-Control: no-store", async () => {
      const response = await fetch(
        `${baseUrl}/api/operation-attempts/req-http-idemp-001`,
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");

      const data = (await response.json()) as any;
      expect(data.state).toBe("APPLIED");
      expect(data.resource).toBeDefined();
      expect(data.resource.kind).toBe("MEMBERSHIP");
      expect(data.resource.data.membershipId).toBe(staffMembershipId);
      expect(data.resource.data.state).toBe("INACTIVE");
    });
  });

  describe("POST /api/operation-attempts/:requestId/close", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await fetch(
        `${baseUrl}/api/operation-attempts/req-http-idemp-001/close`,
        { method: "POST" },
      );
      expect(response.status).toBe(401);
    });

    it("deve retornar APPLIED sem cancelar recurso ao fechar tentativa já aplicada", async () => {
      const response = await fetch(
        `${baseUrl}/api/operation-attempts/req-http-idemp-001/close`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const data = (await response.json()) as any;
      expect(data.state).toBe("APPLIED");
      expect(data.resource.data.membershipId).toBe(staffMembershipId);
    });

    it("deve criar fence NOT_APPLIED e bloquear execução tardia ao fechar antes de aplicar", async () => {
      const fenceRequestId = "req-http-fence-test-001";

      const closeResponse = await fetch(
        `${baseUrl}/api/operation-attempts/${fenceRequestId}/close`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
      );

      expect(closeResponse.status).toBe(200);
      expect(closeResponse.headers.get("cache-control")).toBe("no-store");
      const closeData = (await closeResponse.json()) as any;
      expect(closeData.state).toBe("NOT_APPLIED");

      // Tentativa tardia com o mesmo requestId deve ser bloqueada com 409
      const lateExecResponse = await fetch(
        `${baseUrl}/api/barbershops/${shopId}/team/${staffMembershipId}/deactivation`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            "Idempotency-Key": fenceRequestId,
          },
        },
      );

      expect(lateExecResponse.status).toBe(409);
      const lateData = (await lateExecResponse.json()) as any;
      expect(lateData.code).toBe("OPERATION_ALREADY_CLOSED");
    });
  });
});
