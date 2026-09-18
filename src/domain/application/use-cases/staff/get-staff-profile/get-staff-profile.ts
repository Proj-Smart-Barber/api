import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { StaffsRepository } from "../../../repositories/staffs-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { StaffRole } from "../../../../enterprise/entities/staff";
import type { GetStaffProfileDTO } from "./get-staff-profile-dto";
import type { GetStaffProfileResponse } from "./get-staff-profile-response";

type GetStaffProfileUseCaseResponse = Either<
  ResourceNotFoundError,
  GetStaffProfileResponse
>;

export class GetStaffProfileUseCase {
  constructor(
    private staffsRepository: StaffsRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    staffId,
  }: GetStaffProfileDTO): Promise<GetStaffProfileUseCaseResponse> {
    const staff = await this.staffsRepository.findById(staffId);

    if (!staff) {
      return left(new ResourceNotFoundError());
    }

    let barbershopData:
      | {
          id: string;
          name: string;
          timezone: string;
        }
      | undefined;

    if (staff.role === StaffRole.OWNER) {
      const barbershop =
        await this.barbershopsRepository.findByOwnerId(staffId);
      if (barbershop) {
        barbershopData = {
          id: barbershop.id.toString(),
          name: barbershop.name,
          timezone: barbershop.timezone,
        };
      }
    }

    return right({
      staff: {
        id: staff.id.toString(),
        name: staff.name,
        email: staff.email,
        avatarUrl: staff.avatarUrl,
      },
      barbershop: barbershopData,
    });
  }
}
