import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { Membership, type Role } from "@/domain/enterprise/entities/membership";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { membership } from "../schema";

type RawMembership = InferSelectModel<typeof membership>;
type MembershipInsert = InferInsertModel<typeof membership>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class DrizzleMembershipMapper {
  static toDomain(raw: RawMembership): Membership {
    return Membership.create(
      {
        role: raw.role as Role,
        barbershopId: new UniqueEntityId(raw.barbershopId),
        staffId: new UniqueEntityId(raw.staffId),
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(entity: Membership): MembershipInsert {
    return {
      id: entity.id.toString(),
      role: entity.role,
      barbershopId: entity.barbershopId.toString(),
      staffId: entity.staffId.toString(),
      createdAt: entity.createdAt,
    };
  }
}
