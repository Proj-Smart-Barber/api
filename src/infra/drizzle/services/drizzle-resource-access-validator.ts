import { and, eq } from "drizzle-orm";
import type { OperationResourceKind } from "../../../domain/application/services/operation-attempt-service";
import type { ResourceAccessValidator } from "../../../domain/application/services/resource-access-validator";
import { db } from "../index";
import { bookings, membership } from "../schema";

export class DrizzleResourceAccessValidator implements ResourceAccessValidator {
  async canAccess(
    actorId: string,
    resourceKind?: OperationResourceKind | null,
    resourceId?: string | null,
    tx?: any,
  ): Promise<boolean> {
    if (!resourceKind || !resourceId) {
      return true;
    }

    const executor = tx ?? db;

    if (resourceKind === "MEMBERSHIP") {
      const [targetMem] = await executor
        .select({
          id: membership.id,
          userId: membership.userId,
          barbershopId: membership.barbershopId,
        })
        .from(membership)
        .where(eq(membership.id, resourceId));

      if (!targetMem) {
        return false;
      }

      // Member themselves
      if (targetMem.userId === actorId) {
        return true;
      }

      // Or active OWNER in the same barbershop
      const [ownerMem] = await executor
        .select({ id: membership.id })
        .from(membership)
        .where(
          and(
            eq(membership.barbershopId, targetMem.barbershopId),
            eq(membership.userId, actorId),
            eq(membership.role, "OWNER"),
            eq(membership.state, "ACTIVE"),
          ),
        );

      return Boolean(ownerMem);
    }

    if (resourceKind === "BOOKING") {
      const [targetBooking] = await executor
        .select({
          id: bookings.id,
          customerId: bookings.customerId,
          barbermanId: bookings.barbermanId,
          barbershopId: bookings.barbershopId,
        })
        .from(bookings)
        .where(eq(bookings.id, resourceId));

      if (!targetBooking) {
        return false;
      }

      // Customer or Barberman
      if (targetBooking.customerId === actorId) {
        return true;
      }

      if (targetBooking.barbermanId === actorId) {
        const [professional] = await executor
          .select({ id: membership.id })
          .from(membership)
          .where(
            and(
              eq(membership.barbershopId, targetBooking.barbershopId),
              eq(membership.userId, actorId),
              eq(membership.state, "ACTIVE"),
            ),
          );
        if (professional) return true;
      }
      // Active OWNER in the barbershop
      const [ownerMem] = await executor
        .select({ id: membership.id })
        .from(membership)
        .where(
          and(
            eq(membership.barbershopId, targetBooking.barbershopId),
            eq(membership.userId, actorId),
            eq(membership.role, "OWNER"),
            eq(membership.state, "ACTIVE"),
          ),
        );

      return Boolean(ownerMem);
    }

    if (resourceKind === "SCHEDULE") {
      let shopId = resourceId;
      let targetBarbermanId: string | null = null;

      if (resourceId.includes(":")) {
        const parts = resourceId.split(":");
        shopId = parts[0];
        targetBarbermanId = parts[1] || null;
      }

      // Check if actor is active OWNER of the shop
      const [ownerMem] = await executor
        .select({ id: membership.id })
        .from(membership)
        .where(
          and(
            eq(membership.barbershopId, shopId),
            eq(membership.userId, actorId),
            eq(membership.role, "OWNER"),
            eq(membership.state, "ACTIVE"),
          ),
        );
      if (ownerMem) return true;

      // If targetBarbermanId is actorId (self-schedule)
      if (targetBarbermanId === actorId) {
        const [activeBarber] = await executor
          .select({ id: membership.id })
          .from(membership)
          .where(
            and(
              eq(membership.barbershopId, shopId),
              eq(membership.userId, actorId),
              eq(membership.state, "ACTIVE"),
            ),
          );
        if (activeBarber) return true;
      }

      return false;
    }

    return true;
  }
}
