import { type Either, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";

export interface FetchUserBarbershopsDTO {
  userId: string;
}

export interface UserBarbershopItem {
  id: string;
  name: string;
  role: string;
  status: string;
  timezone: string;
}

export type FetchUserBarbershopsResponse = Either<
  Error,
  { barbershops: UserBarbershopItem[] }
>;

export class FetchUserBarbershopsUseCase {
  constructor(private barbershopsRepository: BarbershopsRepository) {}

  async execute({
    userId,
  }: FetchUserBarbershopsDTO): Promise<FetchUserBarbershopsResponse> {
    const memberships =
      await this.barbershopsRepository.findManyByStaffId(userId);

    const barbershops: UserBarbershopItem[] = memberships.map((item) => ({
      id: item.barbershop.id.toString(),
      name: item.barbershop.name,
      role: item.role,
      status: item.barbershop.status,
      timezone: item.barbershop.timezone,
    }));

    return right({ barbershops });
  }
}
