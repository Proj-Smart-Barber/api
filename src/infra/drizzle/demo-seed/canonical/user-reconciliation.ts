import type {
  SeedCandidate,
  SeedConflict,
  SeedRegistryRecord,
  SeedUserPlan,
} from "./types";

export interface PlanSeedUsersInput {
  namespace?: string;
  fixtures: Array<{
    logicalKey: string;
    name: string;
    email: string;
    cpf: string;
    role?: string;
    accountType?: string;
  }>;
  registry?: Map<string, SeedRegistryRecord> | null;
  users: Array<{
    id: string;
    email: string;
    cpf?: string | null;
    emailVerifiedAt?: Date | null;
  }>;
  provenance?: Record<string, string>; // logicalKey -> proved userId
}

/**
 * Função pura e determinística de planejamento de reconciliação de usuários do seed.
 * Não realiza escritas em banco de dados, nem DDL, nem geração de credenciais.
 */
export function planSeedUsers(input: PlanSeedUsersInput): SeedUserPlan {
  const namespace = input.namespace || "demo-smart-barber-v1";
  const usersByEmail = new Map<string, PlanSeedUsersInput["users"][0]>();
  const usersById = new Map<string, PlanSeedUsersInput["users"][0]>();

  for (const u of input.users) {
    usersByEmail.set(u.email.toLowerCase().trim(), u);
    usersById.set(u.id, u);
  }

  const candidates: SeedCandidate[] = [];
  const newUsers: SeedCandidate[] = [];
  const reusedUsers: SeedCandidate[] = [];
  const verificationUpdates: SeedCandidate[] = [];
  const alreadyVerified: SeedCandidate[] = [];
  const conflicts: SeedConflict[] = [];

  for (const fix of input.fixtures) {
    const normEmail = fix.email.toLowerCase().trim();
    const reg = input.registry?.get(fix.logicalKey);
    const provenId = input.provenance?.[fix.logicalKey];

    const existingByEmail = usersByEmail.get(normEmail);

    // Caso 1: Já registrado no registry ou com proveniência comprovada
    if (reg || provenId) {
      const targetUserId = reg ? reg.recordId : (provenId as string);
      const user = usersById.get(targetUserId);

      if (!user) {
        // Registry aponta para ID inexistente no banco
        conflicts.push({
          logicalKey: fix.logicalKey,
          email: fix.email,
          reason: `Registry record ID ${targetUserId} not found in database`,
          blockedAction: "REUSE",
        });
        continue;
      }

      // Validação de integridade: email deve bater com a fixture gerenciada
      if (user.email.toLowerCase().trim() !== normEmail) {
        conflicts.push({
          logicalKey: fix.logicalKey,
          email: fix.email,
          reason: `Registry identity mismatch: database user email is ${user.email}, expected ${fix.email}`,
          blockedAction: "REUSE",
        });
        continue;
      }

      const needsVerification = user.emailVerifiedAt == null;
      const candidate: SeedCandidate = {
        logicalKey: fix.logicalKey,
        name: fix.name,
        email: fix.email,
        cpf: fix.cpf,
        role: fix.role,
        accountType: fix.accountType,
        isNew: false,
        existingUserId: user.id,
        needsVerificationUpdate: needsVerification,
        emailVerifiedAtAlreadySet: !needsVerification,
      };

      candidates.push(candidate);
      reusedUsers.push(candidate);
      if (needsVerification) {
        verificationUpdates.push(candidate);
      } else {
        alreadyVerified.push(candidate);
      }
      continue;
    }

    // Caso 2: Não está no registry, mas existe usuário no banco com esse email
    if (existingByEmail) {
      // Sem registry nem proveniência explícita, a adoção é bloqueada para não invadir conta externa
      conflicts.push({
        logicalKey: fix.logicalKey,
        email: fix.email,
        reason:
          "Unmanaged email collision: email belongs to an existing user without verified seed provenance",
        blockedAction: "ADOPT",
      });
      continue;
    }

    // Caso 3: Usuário novo
    const candidate: SeedCandidate = {
      logicalKey: fix.logicalKey,
      name: fix.name,
      email: fix.email,
      cpf: fix.cpf,
      role: fix.role,
      accountType: fix.accountType,
      isNew: true,
      needsVerificationUpdate: false, // Novos inserts já criam com emailVerifiedAt
      emailVerifiedAtAlreadySet: false,
    };

    candidates.push(candidate);
    newUsers.push(candidate);
  }

  return {
    namespace,
    candidates,
    newUsers,
    reusedUsers,
    verificationUpdates,
    alreadyVerified,
    conflicts,
    summary: {
      totalPlanned: input.fixtures.length,
      newCount: newUsers.length,
      reusedCount: reusedUsers.length,
      verificationUpdatesCount: verificationUpdates.length,
      alreadyVerifiedCount: alreadyVerified.length,
      conflictsCount: conflicts.length,
    },
  };
}
