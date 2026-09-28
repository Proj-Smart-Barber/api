import { type Either, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";

export interface FetchStaffBarbershopsDTO {
  staffId: string;
}

export interface StaffBarbershopItem {
  id: string;
  name: string;
  role: string;
  status: string;
  timezone: string;
}

export type FetchStaffBarbershopsResponse = Either<
  Error,
  { barbershops: StaffBarbershopItem[] }
>;

export class FetchStaffBarbershopsUseCase {
  constructor(private barbershopsRepository: BarbershopsRepository) {}

  async execute({
    staffId,
  }: FetchStaffBarbershopsDTO): Promise<FetchStaffBarbershopsResponse> {
    const memberships =
      await this.barbershopsRepository.findManyByStaffId(staffId);

    const barbershops: StaffBarbershopItem[] = memberships.map((item) => ({
      id: item.barbershop.id.toString(),
      name: item.barbershop.name,
      role: item.role,
      status: item.barbershop.status,
      timezone: item.barbershop.timezone,
    }));

    return right({ barbershops });
  }
}
