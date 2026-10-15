import { and, eq } from "drizzle-orm";
import type { BarberRegistrationsRepository } from "../../../domain/application/repositories/barber-registrations-repository";
import type { BarberRegistration } from "../../../domain/enterprise/entities/barber-registration";
import { db } from "../index";
import { DrizzleBarberRegistrationMapper } from "../mappers/drizzle-barber-registration-mapper";
import { barberRegistrations } from "../schema";

export class DrizzleBarberRegistrationsRepository
  implements BarberRegistrationsRepository
{
  async create(registration: BarberRegistration): Promise<BarberRegistration> {
    const [created] = await db
      .insert(barberRegistrations)
      .values(DrizzleBarberRegistrationMapper.toDrizzle(registration))
      .returning();

    return DrizzleBarberRegistrationMapper.toDomain(created);
  }

  async save(registration: BarberRegistration): Promise<BarberRegistration> {
    const [updated] = await db
      .update(barberRegistrations)
      .set(DrizzleBarberRegistrationMapper.toDrizzle(registration))
      .where(eq(barberRegistrations.id, registration.id.toString()))
      .returning();

    return DrizzleBarberRegistrationMapper.toDomain(updated);
  }

  async findById(id: string): Promise<BarberRegistration | null> {
    const [row] = await db
      .select()
      .from(barberRegistrations)
      .where(eq(barberRegistrations.id, id));

    if (!row) return null;
    return DrizzleBarberRegistrationMapper.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<BarberRegistration | null> {
    const [row] = await db
      .select()
      .from(barberRegistrations)
      .where(eq(barberRegistrations.tokenHash, tokenHash));

    if (!row) return null;
    return DrizzleBarberRegistrationMapper.toDomain(row);
  }

  async findByBarbershopIdAndEmail(
    barbershopId: string,
    email: string,
  ): Promise<BarberRegistration | null> {
    const [row] = await db
      .select()
      .from(barberRegistrations)
      .where(
        and(
          eq(barberRegistrations.barbershopId, barbershopId),
          eq(barberRegistrations.email, email.toLowerCase()),
        ),
      );

    if (!row) return null;
    return DrizzleBarberRegistrationMapper.toDomain(row);
  }

  async findByCpf(cpf: string): Promise<BarberRegistration | null> {
    const cleanCpf = cpf.replace(/\D/g, "");
    const [row] = await db
      .select()
      .from(barberRegistrations)
      .where(eq(barberRegistrations.cpf, cleanCpf));

    if (!row) return null;
    return DrizzleBarberRegistrationMapper.toDomain(row);
  }
}
