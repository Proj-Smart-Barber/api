import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { users, barbershops, membership, operationAttempts } from "./schema";
import { DrizzleOperationAttemptsRepository } from "./repositories/drizzle-operation-attempts-repository";
import { OperationAttemptService } from "../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../domain/application/services/canonical-operation-hash";
import { DrizzleProfessionalMembershipUnitOfWork } from "./services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "./services/drizzle-resource-access-validator";
import { generateUuidV7 } from "../../core/security/uuidv7";

describe("Operation Attempts & Idempotency Ledger (Task B2 & Checkpoint)", () => {
  let attemptsRepository: DrizzleOperationAttemptsRepository;
  let unitOfWork: DrizzleProfessionalMembershipUnitOfWork;
  let attemptService: OperationAttemptService;
  let accessValidator: DrizzleResourceAccessValidator;

  let actorAId: string;
  let actorBId: string;
  let shopId: string;

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();

  beforeAll(async () => {
    attemptsRepository = new DrizzleOperationAttemptsRepository();
    unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
    accessValidator = new DrizzleResourceAccessValidator();
    attemptService = new OperationAttemptService(
      attemptsRepository,
      unitOfWork,
      accessValidator,
    );

    actorAId = randomUUID();
    await db.insert(users).values({
      id: actorAId,
      name: "Actor A",
      email: `actor_a_${actorAId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "OWNER",
    });

    actorBId = randomUUID();
    await db.insert(users).values({
      id: actorBId,
      name: "Actor B",
      email: `actor_b_${actorBId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "CLIENT",
    });

    shopId = randomUUID();
    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbershop Ledger Test",
      ownerId: actorAId,
      slug: `shop-ledger-${shopId.slice(0, 8)}`,
      cnpj: `${shopId.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}`,
      location: "Rua Ledger, 10",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    await db.insert(membership).values({
      id: randomUUID(),
      barbershopId: shopId,
      userId: actorAId,
      role: "OWNER",
      state: "ACTIVE",
      version: 1,
    });
  });

  afterAll(async () => {
    try {
      await db
        .delete(operationAttempts)
        .where(eq(operationAttempts.actorId, actorAId));
      await db
        .delete(operationAttempts)
        .where(eq(operationAttempts.actorId, actorBId));
      await db.delete(membership).where(eq(membership.barbershopId, shopId));
      await db.delete(barbershops).where(eq(barbershops.id, shopId));
      await db.delete(users).where(eq(users.id, actorAId));
      await db.delete(users).where(eq(users.id, actorBId));
    } catch {
      // ignore
    }
  });

  it("same attempt commits once and returns identical durable result", async () => {
    const requestId = generateUuidV7();
    const payload = {
      action: "DEACTIVATE_MEMBERSHIP",
      unitId: shopId,
      resourceId: "mem-123",
      version: 1,
    };
    const payloadHash = canonicalOperationHash(payload);

    let executionCount = 0;
    const command = async () => {
      executionCount++;
      return {
        resourceKind: "MEMBERSHIP" as const,
        resourceId: "mem-123",
        resourceVersion: 2,
        data: { state: "INACTIVE", version: 2 },
      };
    };

    const firstRun = await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "DEACTIVATE_MEMBERSHIP",
        requestId,
        payloadHash,
      },
      command,
    );

    expect(firstRun.state).toBe("APPLIED");
    expect(firstRun.resource?.id).toBe("mem-123");
    expect(firstRun.resource?.version).toBe(2);
    expect(executionCount).toBe(1);

    // Replay with exact same requestId and payload
    const secondRun = await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "DEACTIVATE_MEMBERSHIP",
        requestId,
        payloadHash,
      },
      command,
    );

    expect(secondRun.state).toBe("APPLIED");
    expect(secondRun.resource?.id).toBe("mem-123");
    expect(secondRun.resource?.version).toBe(2);
    expect(executionCount).toBe(1); // Not executed again!
  });

  it("changed payload conflicts with existing requestId (IDEMPOTENCY_PAYLOAD_MISMATCH)", async () => {
    const requestId = generateUuidV7();
    const payload1 = { action: "TEST_ACTION", param: "alpha" };
    const payload2 = { action: "TEST_ACTION", param: "beta" };

    const hash1 = canonicalOperationHash(payload1);
    const hash2 = canonicalOperationHash(payload2);

    await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "TEST_ACTION",
        requestId,
        payloadHash: hash1,
      },
      async () => ({
        resourceKind: "BOOKING" as const,
        resourceId: "b-1",
        resourceVersion: 1,
        data: { ok: true },
      }),
    );

    // Run with same requestId but different payload hash
    await expect(
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "TEST_ACTION",
          requestId,
          payloadHash: hash2,
        },
        async () => ({
          resourceKind: "BOOKING" as const,
          resourceId: "b-2",
          resourceVersion: 1,
          data: { ok: true },
        }),
      ),
    ).rejects.toThrow("Payload incompatível com a chave de tentativa.");
  });

  it("lost response reconciles after commit via getOwnAttempt", async () => {
    const requestId = generateUuidV7();
    const payload = { action: "TEST_LOST_RESPONSE", unitId: shopId };
    const payloadHash = canonicalOperationHash(payload);

    await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "TEST_LOST_RESPONSE",
        requestId,
        payloadHash,
      },
      async () => ({
        resourceKind: "MEMBERSHIP" as const,
        resourceId: (await db.select({ id: membership.id }).from(membership).where(eq(membership.userId, actorAId)).limit(1))[0].id,
        resourceVersion: 3,
        data: { state: "INACTIVE", version: 3 },
      }),
    );

    // Reconcile via getOwnAttempt
    const attempt = await attemptService.getOwnAttempt(actorAId, requestId);

    expect(attempt).not.toBeNull();
    expect(attempt?.state).toBe("APPLIED");
    expect(attempt?.operation).toBe("TEST_LOST_RESPONSE");
    expect(attempt?.resource?.kind).toBe("MEMBERSHIP");
    expect(attempt?.resource?.id).toBe((await db.select({ id: membership.id }).from(membership).where(eq(membership.userId, actorAId)).limit(1))[0].id);
    expect(attempt?.resource?.version).toBe(3);
    expect(attempt?.resource?.data).toEqual({ state: "INACTIVE", version: 3 });
  });

  it("delayed original after close cannot commit (terminal fence NOT_APPLIED)", async () => {
    const requestId = generateUuidV7();
    const payload = { action: "TEST_CLOSE_FENCE", target: "xyz" };
    const payloadHash = canonicalOperationHash(payload);

    // 1. Close attempt before execution
    const closeResult = await attemptService.closeOwnAttempt(
      actorAId,
      requestId,
    );
    expect(closeResult.state).toBe("NOT_APPLIED");

    // 2. Delayed original arrives
    let executed = false;
    await expect(
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "TEST_CLOSE_FENCE",
          requestId,
          payloadHash,
        },
        async () => {
          executed = true;
          return {
            resourceKind: "BOOKING" as const,
            resourceId: "bk-delayed",
            resourceVersion: 1,
            data: {},
          };
        },
      ),
    ).rejects.toThrow("Operação já encerrada anteriormente.");

    expect(executed).toBe(false);
  });

  it("close after commit returns APPLIED without cancelling resource", async () => {
    const requestId = generateUuidV7();
    const payload = { action: "TEST_CLOSE_AFTER_COMMIT" };
    const payloadHash = canonicalOperationHash(payload);

    await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "TEST_CLOSE_AFTER_COMMIT",
        requestId,
        payloadHash,
      },
      async () => ({
        resourceKind: "BOOKING" as const,
        resourceId: "bk-committed",
        resourceVersion: 1,
        data: { status: "CONFIRMED" },
      }),
    );

    const closeResult = await attemptService.closeOwnAttempt(
      actorAId,
      requestId,
    );
    expect(closeResult.state).toBe("APPLIED");
    expect(closeResult.resource?.id).toBe("bk-committed");
  });

  it("actor isolation prevents actor B from accessing actor A attempt", async () => {
    const requestId = generateUuidV7();
    const payloadHash = canonicalOperationHash({ action: "ISOLATION_TEST" });

    await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "ISOLATION_TEST",
        requestId,
        payloadHash,
      },
      async () => ({
        resourceKind: "BOOKING" as const,
        resourceId: "bk-isolated",
        resourceVersion: 1,
        data: { privateField: "secret" },
      }),
    );

    const attemptForB = await attemptService.getOwnAttempt(actorBId, requestId);
    expect(attemptForB).toBeNull();

    // Closing attempt for B does not touch A's attempt
    const closeForB = await attemptService.closeOwnAttempt(actorBId, requestId);
    expect(closeForB.state).toBe("NOT_APPLIED");

    // A's attempt is still APPLIED
    const attemptForA = await attemptService.getOwnAttempt(actorAId, requestId);
    expect(attemptForA?.state).toBe("APPLIED");
  });

  it("concurrent attempts with same requestId commit only once", async () => {
    const requestId = generateUuidV7();
    const payloadHash = canonicalOperationHash({ action: "CONCURRENT_TEST" });

    let executions = 0;
    const task = () =>
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "CONCURRENT_TEST",
          requestId,
          payloadHash,
        },
        async () => {
          executions++;
          await new Promise((r) => setTimeout(r, 50));
          return {
            resourceKind: "MEMBERSHIP" as const,
            resourceId: "mem-concurrent",
            resourceVersion: 1,
            data: { ok: true },
          };
        },
      );

    const [res1, res2] = await Promise.all([task(), task()]);

    expect(executions).toBe(1);
    expect(res1.state).toBe("APPLIED");
    expect(res2.state).toBe("APPLIED");
    expect(res1.resource?.id).toBe("mem-concurrent");
    expect(res2.resource?.id).toBe("mem-concurrent");
  });

  // ── Novos testes do Checkpoint Inicial E1/B2 ──────────────────

  it("rejeita chave com formato não-UUIDv7 (INVALID_IDEMPOTENCY_KEY)", async () => {
    const invalidKey = "not-a-valid-uuidv7";
    await expect(
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "TEST_INVALID_FORMAT",
          requestId: invalidKey,
          payloadHash: "dummy",
        },
        async () => ({
          resourceKind: "BOOKING",
          resourceId: "b-1",
          data: {},
        }),
      ),
    ).rejects.toThrow("Chave de idempotência inválida");
  });

  it("rejeita chave com timestamp no futuro superior a 5 minutos (IDEMPOTENCY_KEY_FUTURE_TIMESTAMP)", async () => {
    const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutos no futuro
    const futureKey = generateUuidV7(futureTime);

    await expect(
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "TEST_FUTURE_KEY",
          requestId: futureKey,
          payloadHash: "dummy",
        },
        async () => ({
          resourceKind: "BOOKING",
          resourceId: "b-future",
          data: {},
        }),
      ),
    ).rejects.toThrow("timestamp no futuro superior a 5 minutos");
  });

  it("rejeita chave expirada além de 24 horas para nova tentativa (IDEMPOTENCY_KEY_EXPIRED)", async () => {
    const expiredTime = Date.now() - 25 * 60 * 60 * 1000; // 25 horas atrás
    const expiredKey = generateUuidV7(expiredTime);

    await expect(
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "TEST_EXPIRED_KEY",
          requestId: expiredKey,
          payloadHash: "dummy",
        },
        async () => ({
          resourceKind: "BOOKING",
          resourceId: "b-expired",
          data: {},
        }),
      ),
    ).rejects.toThrow("Chave de idempotência expirada");
  });

  it("resultado já aplicado permanece consultável após janela de 24 horas", async () => {
    const oldTime = Date.now() - 26 * 60 * 60 * 1000;
    const oldKey = generateUuidV7(oldTime);

    // Simular que foi aplicado no passado gravando diretamente no ledger
    await attemptsRepository.create({
      id: randomUUID(),
      actorId: actorAId,
      requestId: oldKey,
      operation: "TEST_DURABLE_PAST",
      payloadHash: "hash_old",
      state: "APPLIED",
      resourceKind: "MEMBERSHIP",
      resourceId: (await db.select({ id: membership.id }).from(membership).where(eq(membership.userId, actorAId)).limit(1))[0].id,
      resourceVersion: 1,
      responsePayload: JSON.stringify({ state: "INACTIVE", durable: true }),
      terminalReason: null,
      createdAt: new Date(oldTime),
      updatedAt: new Date(oldTime),
      expiresAt: new Date(oldTime + 24 * 60 * 60 * 1000),
    });

    const recovered = await attemptService.getOwnAttempt(actorAId, oldKey);
    expect(recovered).not.toBeNull();
    expect(recovered?.state).toBe("APPLIED");
    expect(recovered?.resource?.data).toEqual({
      state: "INACTIVE",
      durable: true,
    });
  });

  it("falha no pós-comando provoca rollback completo de mutação no mesmo tx", async () => {
    const testMemberId = randomUUID();
    await db.insert(membership).values({
      id: testMemberId,
      barbershopId: shopId,
      userId: actorBId,
      role: "BARBERMAN",
      state: "ACTIVE",
      version: 1,
    });

    const requestId = generateUuidV7();
    const payloadHash = canonicalOperationHash({
      action: "TEST_ROLLBACK",
      memId: testMemberId,
    });

    // Comando executa mutação no tx, mas lança erro antes de concluir com sucesso
    await expect(
      attemptService.executeOnce(
        {
          actorId: actorAId,
          operation: "TEST_ROLLBACK",
          requestId,
          payloadHash,
        },
        async (tx) => {
          // Modifica o estado do membership para INACTIVE dentro da transação
          await tx
            .update(membership)
            .set({ state: "INACTIVE", version: 2 })
            .where(eq(membership.id, testMemberId));

          // Força falha inesperada antes do commit do ledger
          throw new Error("FORCED_TX_ERROR_BEFORE_COMMIT");
        },
      ),
    ).rejects.toThrow("FORCED_TX_ERROR_BEFORE_COMMIT");

    // Verificar que a mutação no membership foi TOTALMENTE revertida (rollback)
    const [persistedMem] = await db
      .select()
      .from(membership)
      .where(eq(membership.id, testMemberId));

    expect(persistedMem?.state).toBe("ACTIVE");
    expect(persistedMem?.version).toBe(1);

    // Verificar que a tentativa também não ficou persistida como APPLIED
    const attempt = await attemptService.getOwnAttempt(actorAId, requestId);
    expect(attempt).toBeNull();

    await db.delete(membership).where(eq(membership.id, testMemberId));
  });

  it("replay e consulta indicam accessChanged=true e removem DTO privado se autoridade mudou", async () => {
    // 1. Criar recurso e gravar attempt
    const targetUserId = randomUUID();
    const targetMemId = randomUUID();

    await db.insert(users).values({
      id: targetUserId,
      name: "Target Staff",
      email: `target_${targetUserId.slice(0, 8)}@test.com`,
      password: "hash",
      cpf: randomCpf(),
      accountType: "CLIENT",
    });

    await db.insert(membership).values({
      id: targetMemId,
      barbershopId: shopId,
      userId: targetUserId,
      role: "BARBERMAN",
      state: "ACTIVE",
      version: 1,
    });

    const reqId = generateUuidV7();
    const hash = canonicalOperationHash({ action: "DEACTIVATE", targetMemId });

    await attemptService.executeOnce(
      {
        actorId: actorAId,
        operation: "DEACTIVATE",
        requestId: reqId,
        payloadHash: hash,
        resourceKind: "MEMBERSHIP",
      },
      async () => ({
        resourceKind: "MEMBERSHIP",
        resourceId: targetMemId,
        resourceVersion: 2,
        data: { sensitiveInfo: "private-data", membershipId: targetMemId },
      }),
    );

    // Enquanto ator A é OWNER, ele lê os dados
    const readWithOwner = await attemptService.getOwnAttempt(actorAId, reqId);
    expect(readWithOwner?.accessChanged).toBe(false);
    expect(readWithOwner?.resource?.data).toHaveProperty("sensitiveInfo");

    // Agora remover permissão de OWNER do ator A na barbearia
    await db
      .update(membership)
      .set({ state: "INACTIVE" })
      .where(
        and(
          eq(membership.barbershopId, shopId),
          eq(membership.userId, actorAId),
        ),
      );

    // Ao consultar novamente após perda de autoridade:
    const readAfterRevocation = await attemptService.getOwnAttempt(
      actorAId,
      reqId,
    );
    expect(readAfterRevocation?.state).toBe("APPLIED");
    expect(readAfterRevocation?.accessChanged).toBe(true);
    // Dados privados devem ser omitidos
    expect(readAfterRevocation?.resource?.data).toBeUndefined();

    // Restaurar OWNER para cleanup
    await db
      .update(membership)
      .set({ state: "ACTIVE" })
      .where(
        and(
          eq(membership.barbershopId, shopId),
          eq(membership.userId, actorAId),
        ),
      );

    await db.delete(membership).where(eq(membership.id, targetMemId));
    await db.delete(users).where(eq(users.id, targetUserId));
  });
});
