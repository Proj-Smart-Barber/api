import type { InferSelectModel } from "drizzle-orm";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { staffs } from "../../../infra/drizzle/schema";
import { Staff } from "../entities/staff";
import { Password } from "../entities/value-objects/password";

type PersistenceStaff = InferSelectModel<typeof staffs>;

// biome-ignore lint/complexity/noStaticOnlyClass: follows the existing mapper convention
export class StaffMapper {
  static toDomain(raw: PersistenceStaff) {
    return Staff.create(
      {
        name: raw.name,
        avatarUrl: raw.avatarUrl ?? undefined,
        password: Password.create(raw.password),
        email: raw.email,
        cpf: raw.cpf,
        createdAt: raw.createdAt ?? new Date(),
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPersistence(staff: Staff) {
    return {
      id: staff.id.toString(),
      avatarUrl: staff.avatarUrl,
      password: staff.password.toString(),
      email: staff.email,
      cpf: staff.cpf,
      createdAt: staff.createdAt ?? new Date(),
    };
  }
}
