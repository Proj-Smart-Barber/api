import { describe, expect, it, vi } from "vitest";
import { UserReconciliationRepository } from "./user-reconciliation.repository";
import type { SeedUserPlan } from "./types";

// Mock do db do drizzle
vi.mock("../index", () => {
  return {
    db: {
      transaction: vi.fn(async (callback) => {
        const fakeTx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi
            .fn()
            .mockImplementation(async () => [{ id: "mock-id" }]),
        };
        return callback(fakeTx);
      }),
    },
  };
});

describe("UserReconciliationRepository", () => {
  it("managed_null_is_verified and second_apply_is_idempotent", async () => {
    const repo = new UserReconciliationRepository();

    const plan: SeedUserPlan = {
      namespace: "demo-smart-barber-v1",
      candidates: [],
      newUsers: [],
      reusedUsers: [
        {
          logicalKey: "horizonte:staff:wellington",
          name: "Wellington",
          email: "demo.wellingtonspdev@example.com",
          cpf: "10111122210",
          isNew: false,
          existingUserId: "user-123",
          needsVerificationUpdate: true,
          emailVerifiedAtAlreadySet: false,
        },
      ],
      verificationUpdates: [
        {
          logicalKey: "horizonte:staff:wellington",
          name: "Wellington",
          email: "demo.wellingtonspdev@example.com",
          cpf: "10111122210",
          isNew: false,
          existingUserId: "user-123",
          needsVerificationUpdate: true,
          emailVerifiedAtAlreadySet: false,
        },
      ],
      alreadyVerified: [],
      conflicts: [],
      summary: {
        totalPlanned: 1,
        newCount: 0,
        reusedCount: 1,
        verificationUpdatesCount: 1,
        alreadyVerifiedCount: 0,
        conflictsCount: 0,
      },
    };

    const result = await repo.applyVerificationBackfill(plan);

    expect(result.verifiedNow).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(result.reused).toBe(1);

    // Segundo plano: sem verificação pendente
    const secondPlan: SeedUserPlan = {
      ...plan,
      verificationUpdates: [],
      alreadyVerified: plan.reusedUsers,
      summary: {
        ...plan.summary,
        verificationUpdatesCount: 0,
        alreadyVerifiedCount: 1,
      },
    };

    const secondResult = await repo.applyVerificationBackfill(secondPlan);
    expect(secondResult.verifiedNow).toBe(0);
    expect(secondResult.alreadyVerified).toBe(1);
  });

  it("non_seed_user_stays_unverified as they are never included in verificationUpdates", async () => {
    const repo = new UserReconciliationRepository();

    // Plano que não tem usuários externos em verificationUpdates
    const plan: SeedUserPlan = {
      namespace: "demo-smart-barber-v1",
      candidates: [],
      newUsers: [],
      reusedUsers: [],
      verificationUpdates: [],
      alreadyVerified: [],
      conflicts: [
        {
          logicalKey: "external:user",
          email: "cliente.real@gmail.com",
          reason: "Unmanaged account",
          blockedAction: "ADOPT",
        },
      ],
      summary: {
        totalPlanned: 1,
        newCount: 0,
        reusedCount: 0,
        verificationUpdatesCount: 0,
        alreadyVerifiedCount: 0,
        conflictsCount: 1,
      },
    };

    const result = await repo.applyVerificationBackfill(plan);

    expect(result.verifiedNow).toBe(0);
    expect(result.conflicts).toBe(1);
  });
});
