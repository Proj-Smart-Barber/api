import type { Staff } from "@/domain/enterprise/entities/staff";

export interface StaffsRepository {
  findByCpfOrEmail(cpf: string, email: string): Promise<Staff | null>;
  save(staff: Staff): Promise<Staff>;
}
