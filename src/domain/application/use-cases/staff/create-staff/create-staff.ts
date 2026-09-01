import { type Either, left, right } from "../../../../../core/logic/either";
import { Staff, type StaffRole } from "../../../../enterprise/entities/staff";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { StaffsRepository } from "../../../repositories/staffs-repository";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import type { CreateStaffDTO } from "./create-staff-dto";
import type { CreateStaffResponse } from "./create-staff-response";

type CreateStaffUseCaseResponse = Either<
  CPFOrEmailAlreadyInUseError,
  CreateStaffResponse
>;

export class CreateStaffUseCase {
  constructor(private staffsRepository: StaffsRepository) {}

  async execute({
    name,
    email,
    password,
    cpf,
  }: CreateStaffDTO): Promise<CreateStaffUseCaseResponse> {
    const staffAlreadyExists = await this.staffsRepository.findByCpfOrEmail(
      cpf,
      email,
    );

    if (staffAlreadyExists) {
      return left(new CPFOrEmailAlreadyInUseError());
    }

    const newStaff = Staff.create({
      name,
      email,
      password: await Password.generateHashFromPlainText(password, 12),
      cpf,
      role: "OWNER" as unknown as StaffRole,
    });

    const staff = await this.staffsRepository.save(newStaff);

    return right({
      staffId: staff.id.toString(),
    });
  }
}
