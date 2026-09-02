import type { Staff } from "../../enterprise/entities/staff";

export interface StaffsRepository {
  findByEmail(email: string): Promise<Staff | null>;
  findByCpfOrEmail(cpf: string, email: string): Promise<Staff | null>;
  save(staff: Staff): Promise<Staff>;
}
