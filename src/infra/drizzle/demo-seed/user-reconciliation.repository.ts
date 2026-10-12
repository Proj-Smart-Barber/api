import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";
import type { SeedUserPlan } from "./types";

export interface ApplySeedPlanResult {
  created: number;
  reused: number;
  verifiedNow: number;
  alreadyVerified: number;
  conflicts: number;
}

export class UserReconciliationRepository {
  /**
   * Aplica a reconciliação e preenchimento de verificação de e-mail para usuários
   * estritamente aprovados no plano de seed.
   * Não altera senhas, não envia e-mails e não toca em contas externas.
   */
  async applyVerificationBackfill(
    plan: SeedUserPlan,
  ): Promise<ApplySeedPlanResult> {
    let verifiedNow = 0;
    let alreadyVerified = plan.alreadyVerified.length;

    // Executa atualizações sob transação segura
    await db.transaction(async (tx) => {
      for (const updateCandidate of plan.verificationUpdates) {
        if (!updateCandidate.existingUserId) continue;

        // Atualização atômica e seletiva: somente se id bater, email bater E emailVerifiedAt for NULL
        const updated = await tx
          .update(users)
          .set({
            emailVerifiedAt: sql`NOW()`,
          })
          .where(
            and(
              eq(users.id, updateCandidate.existingUserId),
              eq(users.email, updateCandidate.email),
              isNull(users.emailVerifiedAt),
            ),
          )
          .returning({ id: users.id });

        if (updated.length > 0) {
          verifiedNow++;
        } else {
          alreadyVerified++;
        }
      }
    });

    return {
      created: plan.newUsers.length,
      reused: plan.reusedUsers.length,
      verifiedNow,
      alreadyVerified,
      conflicts: plan.conflicts.length,
    };
  }
}
