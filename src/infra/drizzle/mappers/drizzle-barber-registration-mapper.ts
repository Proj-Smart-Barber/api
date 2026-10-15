import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { BarberRegistration } from "../../../domain/enterprise/entities/barber-registration";
import type { barberRegistrations } from "../schema";

type DrizzleBarberRegistration = typeof barberRegistrations.$inferSelect;
type DrizzleBarberRegistrationInsert =
  typeof barberRegistrations.$inferInsert;

// biome-ignore lint/complexity/noStaticOnlyClass: Mapper convention
export class DrizzleBarberRegistrationMapper {
  static toDomain(raw: DrizzleBarberRegistration): BarberRegistration {
    return BarberRegistration.create(
      {
        barbershopId: new UniqueEntityId(raw.barbershopId),
        invitationId: new UniqueEntityId(raw.invitationId),
        name: raw.name,
        cpf: raw.cpf,
        email: raw.email,
        tokenHash: raw.tokenHash,
        status: raw.status as any,
        expiresAt: raw.expiresAt,
        respondedAt: raw.respondedAt,
        createdAt: raw.createdAt ?? undefined,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toDrizzle(
    registration: BarberRegistration,
  ): DrizzleBarberRegistrationInsert {
    return {
      id: registration.id.toString(),
      barbershopId: registration.barbershopId.toString(),
      invitationId: registration.invitationId.toString(),
      name: registration.name,
      cpf: registration.cpf,
      email: registration.email,
      tokenHash: registration.tokenHash,
      status: registration.status,
      expiresAt: registration.expiresAt,
      respondedAt: registration.respondedAt ?? null,
      createdAt: registration.createdAt,
    };
  }
}
