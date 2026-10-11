import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

import { Role } from "../../../../enterprise/entities/membership";

export interface ListBarbershopProfessionalsDTO {
  shopId: string;
}

export interface BarbershopProfessionalItem {
  id: string;
  name: string;
  role: string;
}

export interface ListBarbershopProfessionalsResponse {
  professionals: BarbershopProfessionalItem[];
}

type ListBarbershopProfessionalsUseCaseResponse = Either<
  ResourceNotFoundError,
  ListBarbershopProfessionalsResponse
>;

export class ListBarbershopProfessionalsUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute({
    shopId,
  }: ListBarbershopProfessionalsDTO): Promise<ListBarbershopProfessionalsUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    const memberships =
      await this.membershipsRepository.findManyByBarbershopId(shopId);

    // Filtrar membros elegíveis para atendimento (BARBERMAN e OWNER conforme spec D10/D11)
    const eligibleMemberships = memberships.filter(
      (m) => m.role === Role.BARBERMAN || m.role === Role.OWNER,
    );

    const professionals: BarbershopProfessionalItem[] = [];

    for (const member of eligibleMemberships) {
      const user = await this.usersRepository.findById(
        member.userId.toString(),
      );
      if (user) {
        professionals.push({
          id: user.id.toString(),
          name: user.name,
          role: member.role,
        });
      }
    }

    return right({ professionals });
  }
}
