import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Invitation } from "../../../domain/enterprise/entities/invitation";
import type { Role } from "../../../domain/enterprise/entities/membership";
import type { invitations } from "../schema";

type RawInvitation = InferSelectModel<typeof invitations>;
type InvitationInsert = InferInsertModel<typeof invitations>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class DrizzleInvitationMapper {
  static toDomain(raw: RawInvitation): Invitation {
    return Invitation.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        email: raw.email,
        role: raw.role as Role,
        tokenHash: raw.tokenHash,
        status: raw.status,
        expiresAt: raw.expiresAt,
        invitedById: new UniqueEntityId(raw.invitedById),
        respondedAt: raw.respondedAt ?? null,
        createdAt: raw.createdAt ?? new Date(),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(entity: Invitation): InvitationInsert {
    return {
      id: entity.id.toString(),
      barbershopId: entity.barbershopId.toString(),
      email: entity.email,
      role: entity.role,
      tokenHash: entity.tokenHash,
      status: entity.status,
      expiresAt: entity.expiresAt,
      invitedById: entity.invitedById.toString(),
      respondedAt: entity.respondedAt ?? null,
      createdAt: entity.createdAt,
    };
  }
}
