import type { StaffsRepository } from "../../../repositories/staffs-repository";
import type { CreateStaffDTO } from "./create-staff-dto";
import type { CreateStaffResponse } from "./create-staff-response";
import { Staff, StaffRole } from "../../../../enterprise/entities/staff";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import { Either, left, right } from "../../../../../core/logic/either";
import { Password } from "../../../../enterprise/entities/value-objects/password";

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
      role: "BARBERMAN" as unknown as StaffRole,
    });

    const staff = await this.staffsRepository.save(newStaff);

    return right({
      staffId: staff.id.toString(),
    });
  }
}
