import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, barbershops, membership, operationAttempts } from "./schema";
import { DrizzleOperationAttemptsRepository } from "./repositories/drizzle-operation-attempts-repository";
import { OperationAttemptService } from "../../domain/application/services/operation-attempt-service";
import { canonicalOperationHash } from "../../domain/application/services/canonical-operation-hash";
import { DrizzleProfessionalMembershipUnitOfWork } from "./services/drizzle-professional-membership-unit-of-work";

describe("Operation Attempts & Idempotency Ledger (Task B2)", () => {
  let attemptsRepository: DrizzleOperationAttemptsRepository;
  let unitOfWork: DrizzleProfessionalMembershipUnitOfWork;
  let attemptService: OperationAttemptService;

  let actorAId: string;
  let actorBId: string;
  let shopId: string;

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();

  beforeAll(async () => {
    attemptsRepository = new DrizzleOperationAttemptsRepository();
    unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
    attemptService = new OperationAttemptService(
      attemptsRepository,
      unitOfWork,
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
    const requestId = randomUUID();
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
    const requestId = randomUUID();
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
    ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_MISMATCH");
  });

  it("lost response reconciles after commit via getOwnAttempt", async () => {
    const requestId = randomUUID();
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
        resourceId: "mem-456",
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
    expect(attempt?.resource?.id).toBe("mem-456");
    expect(attempt?.resource?.version).toBe(3);
    expect(attempt?.resource?.data).toEqual({ state: "INACTIVE", version: 3 });
  });

  it("delayed original after close cannot commit (terminal fence NOT_APPLIED)", async () => {
    const requestId = randomUUID();
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
    ).rejects.toThrow("OPERATION_ALREADY_CLOSED");

    expect(executed).toBe(false);
  });

  it("close after commit returns APPLIED without cancelling resource", async () => {
    const requestId = randomUUID();
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
    const requestId = randomUUID();
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
    const requestId = randomUUID();
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
          // Small delay to simulate work
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
});
