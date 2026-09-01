import type { StaffsRepository } from "../../src/domain/application/repositories/staffs-repository";
import type { Staff } from "../../src/domain/enterprise/entities/staff";

export class InMemoryStaffsRepository implements StaffsRepository {
  private staffs: Staff[] = [];

  async findByCpfOrEmail(cpf: string, email: string): Promise<Staff | null> {
    const staff = this.staffs.find(
      (staff) => staff.cpf === cpf || staff.email === email,
    );

    if (!staff) {
      return null;
    }

    return staff;
  }

  async save(staff: Staff): Promise<Staff> {
    this.staffs.push(staff);

    return staff;
  }
}
