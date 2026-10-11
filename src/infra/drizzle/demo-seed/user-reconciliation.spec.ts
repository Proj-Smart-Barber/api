import { describe, expect, it, vi } from "vitest";
import { planSeedUsers } from "./user-reconciliation";
import type { SeedRegistryRecord } from "./types";

describe("Seed User Reconciliation (Plan)", () => {
  const dummyFixtures = [
    {
      logicalKey: "horizonte:staff:wellington",
      name: "Wellington Siqueira Porto",
      email: "demo.wellingtonspdev@example.com",
      cpf: "10111122210",
      role: "OWNER",
    },
    {
      logicalKey: "horizonte:customer:lucas",
      name: "Lucas Andrade",
      email: "lucas.andrade.demo@example.com",
      cpf: "20100100198",
    },
  ];

  it("unmanaged_email_collision_is_not_adopted", () => {
    // Cenário: Um usuário com o email da fixture já existe no banco, mas não há registry nem provenance
    const usersInDb = [
      {
        id: "external-user-id",
        email: "demo.wellingtonspdev@example.com",
        emailVerifiedAt: null,
      },
    ];

    const plan = planSeedUsers({
      fixtures: dummyFixtures,
      registry: new Map(),
      users: usersInDb,
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].logicalKey).toBe("horizonte:staff:wellington");
    expect(plan.conflicts[0].blockedAction).toBe("ADOPT");
    expect(plan.verificationUpdates).toHaveLength(0);
    expect(plan.reusedUsers).toHaveLength(0);
    // Lucas não colidiu e é novo
    expect(plan.newUsers).toHaveLength(1);
    expect(plan.newUsers[0].logicalKey).toBe("horizonte:customer:lucas");
  });

  it("registry_identity_mismatch_is_blocked", () => {
    // Cenário: Registry aponta para um ID, mas o usuário correspondente no banco tem outro email
    const registry = new Map<string, SeedRegistryRecord>([
      [
        "horizonte:staff:wellington",
        {
          id: "reg-1",
          namespace: "demo-smart-barber-v1",
          logicalKey: "horizonte:staff:wellington",
          tableName: "users",
          recordId: "user-123",
          createdAt: new Date(),
        },
      ],
    ]);

    const usersInDb = [
      {
        id: "user-123",
        email: "outro-email-completamente-diferente@example.com",
        emailVerifiedAt: null,
      },
    ];

    const plan = planSeedUsers({
      fixtures: [dummyFixtures[0]],
      registry,
      users: usersInDb,
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].reason).toContain("Registry identity mismatch");
    expect(plan.reusedUsers).toHaveLength(0);
    expect(plan.verificationUpdates).toHaveLength(0);
  });

  it("dry_run_has_no_db_or_file_writes", () => {
    // Garantir que a função planSeedUsers não emite chamadas I/O
    const writeSpy = vi.fn();
    const plan = planSeedUsers({
      fixtures: dummyFixtures,
      registry: null,
      users: [],
    });

    expect(writeSpy).not.toHaveBeenCalled();
    expect(plan.summary.totalPlanned).toBe(2);
    expect(plan.summary.newCount).toBe(2);
  });

  it("reused_managed_user_with_null_verification_is_scheduled_for_update", () => {
    const registry = new Map<string, SeedRegistryRecord>([
      [
        "horizonte:staff:wellington",
        {
          id: "reg-1",
          namespace: "demo-smart-barber-v1",
          logicalKey: "horizonte:staff:wellington",
          tableName: "users",
          recordId: "wellington-user-id",
          createdAt: new Date(),
        },
      ],
    ]);

    const usersInDb = [
      {
        id: "wellington-user-id",
        email: "demo.wellingtonspdev@example.com",
        emailVerifiedAt: null, // Verificação nula!
      },
    ];

    const plan = planSeedUsers({
      fixtures: [dummyFixtures[0]],
      registry,
      users: usersInDb,
    });

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.reusedUsers).toHaveLength(1);
    expect(plan.verificationUpdates).toHaveLength(1);
    expect(plan.verificationUpdates[0].existingUserId).toBe(
      "wellington-user-id",
    );
    expect(plan.alreadyVerified).toHaveLength(0);
  });

  it("reused_managed_user_with_existing_verification_preserves_timestamp", () => {
    const registry = new Map<string, SeedRegistryRecord>([
      [
        "horizonte:staff:wellington",
        {
          id: "reg-1",
          namespace: "demo-smart-barber-v1",
          logicalKey: "horizonte:staff:wellington",
          tableName: "users",
          recordId: "wellington-user-id",
          createdAt: new Date(),
        },
      ],
    ]);

    const verifiedDate = new Date("2026-01-01T10:00:00Z");
    const usersInDb = [
      {
        id: "wellington-user-id",
        email: "demo.wellingtonspdev@example.com",
        emailVerifiedAt: verifiedDate, // Já verificado!
      },
    ];

    const plan = planSeedUsers({
      fixtures: [dummyFixtures[0]],
      registry,
      users: usersInDb,
    });

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.reusedUsers).toHaveLength(1);
    expect(plan.verificationUpdates).toHaveLength(0);
    expect(plan.alreadyVerified).toHaveLength(1);
  });
});
