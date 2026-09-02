import { db } from "..";
import { staffs } from "../schema";
import { StaffMapper } from "../../../domain/enterprise/mappers/staff-mapper";
import { eq, or } from "drizzle-orm";
import type { StaffsRepository } from "../../../domain/application/repositories/staffs-repository";
import type { Staff } from "../../../domain/enterprise/entities/staff";

export class DrizzleStaffsRepository implements StaffsRepository {
  async findById(id: string): Promise<Staff | null> {
    const [staff] = await db.select().from(staffs).where(eq(staffs.id, id));

    if (!staff) {
      return null;
    }

    return StaffMapper.toDomain(staff);
  }

  async findByEmail(email: string): Promise<Staff | null> {
    const [staff] = await db
      .select()
      .from(staffs)
      .where(eq(staffs.email, email));

    if (!staff) {
      return null;
    }

    return StaffMapper.toDomain(staff);
  }

  async findByCpfOrEmail(cpf: string, email: string): Promise<Staff | null> {
    const [staff] = await db
      .select()
      .from(staffs)
      .where(or(eq(staffs.cpf, cpf), eq(staffs.email, email)));

    if (!staff) {
      return null;
    }

    return StaffMapper.toDomain(staff);
  }

  async save(staff: Staff): Promise<Staff> {
    const [createdStaff] = await db
      .insert(staffs)
      .values({
        name: staff.name,
        email: staff.email,
        password: staff.password.toString(),
        cpf: staff.cpf,
        role: "OWNER",
      })
      .returning();

    return StaffMapper.toDomain(createdStaff);
  }
}
