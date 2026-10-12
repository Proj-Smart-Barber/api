import { asc, inArray, sql } from "drizzle-orm";
import type {
  LockResources,
  ProfessionalMembershipUnitOfWork,
  UnitOfWorkContext,
} from "../../../domain/application/services/professional-membership-unit-of-work";
import { db } from "../index";
import { barbershops, bookings, membership, users } from "../schema";

export class DrizzleProfessionalMembershipUnitOfWork
  implements ProfessionalMembershipUnitOfWork
{
  async withLocks<T>(
    resources: LockResources,
    work: (tx: any, context: UnitOfWorkContext) => Promise<T>,
    existingTx?: any,
  ): Promise<T> {
    const runInTx = async (tx: any) => {
      // 0. Attempt advisory lock when applicable
      if (resources.attempt) {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${resources.attempt.actorId}), hashtext(${resources.attempt.requestId}))`,
        );
      }

      // 1. Units in deterministic sorted order
      const sortedUnitIds = Array.from(
        new Set(resources.unitIds?.filter(Boolean) ?? []),
      ).sort();
      if (sortedUnitIds.length > 0) {
        await tx
          .select({ id: barbershops.id })
          .from(barbershops)
          .where(inArray(barbershops.id, sortedUnitIds))
          .orderBy(asc(barbershops.id))
          .for("update");
      }

      // 2. Global professionals in deterministic sorted order
      const sortedProfIds = Array.from(
        new Set(resources.professionalIds?.filter(Boolean) ?? []),
      ).sort();
      if (sortedProfIds.length > 0) {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, sortedProfIds))
          .orderBy(asc(users.id))
          .for("update");
      }

      // 3. Memberships in deterministic sorted order
      const sortedMembershipIds = Array.from(
        new Set(resources.membershipIds?.filter(Boolean) ?? []),
      ).sort();
      if (sortedMembershipIds.length > 0) {
        await tx
          .select({
            id: membership.id,
            state: membership.state,
            version: membership.version,
          })
          .from(membership)
          .where(inArray(membership.id, sortedMembershipIds))
          .orderBy(asc(membership.id))
          .for("update");
      }

      // 4. Bookings in deterministic sorted order
      const sortedBookingIds = Array.from(
        new Set(resources.bookingIds?.filter(Boolean) ?? []),
      ).sort();
      if (sortedBookingIds.length > 0) {
        await tx
          .select({
            id: bookings.id,
            status: bookings.status,
            version: bookings.version,
          })
          .from(bookings)
          .where(inArray(bookings.id, sortedBookingIds))
          .orderBy(asc(bookings.id))
          .for("update");
      }

      // 5. Fresh clock_timestamp queried strictly after acquiring all locks
      const clockResult = await tx.execute(
        sql`SELECT clock_timestamp() AS server_time`,
      );
      const rows = (clockResult as any).rows ?? clockResult;
      const rawTime = rows?.[0]?.server_time;
      if (!rawTime) {
        throw new Error("DATABASE_CLOCK_UNAVAILABLE");
      }
      const serverTime = new Date(rawTime);
      if (Number.isNaN(serverTime.getTime())) {
        throw new Error("DATABASE_CLOCK_INVALID");
      }

      return await work(tx, { serverTime });
    };

    if (existingTx) {
      return await runInTx(existingTx);
    }

    return await db.transaction(async (tx) => {
      return await runInTx(tx);
    });
  }
}
