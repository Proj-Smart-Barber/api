import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { StaffsRepository } from "../../../repositories/staffs-repository";
import type { GetStaffProfileDTO } from "./get-staff-profile-dto";
import type { GetStaffProfileResponse } from "./get-staff-profile-response";

type GetStaffProfileUseCaseResponse = Either<
  ResourceNotFoundError,
  GetStaffProfileResponse
>;

export class GetStaffProfileUseCase {
  constructor(private staffsRepository: StaffsRepository) {}

  async execute({
    staffId,
  }: GetStaffProfileDTO): Promise<GetStaffProfileUseCaseResponse> {
    const staff = await this.staffsRepository.findById(staffId);

    if (!staff) {
      return left(new ResourceNotFoundError());
    }

    return right({
      staff: {
        id: staff.id.toString(),
        name: staff.name,
        email: staff.email,
        avatarUrl: staff.avatarUrl,
        role: staff.role,
      },
    });
  }
}
