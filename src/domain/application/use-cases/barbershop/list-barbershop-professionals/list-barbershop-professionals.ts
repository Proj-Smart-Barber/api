import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

import { Role } from "../../../../enterprise/entities/membership";

export interface ListBarbershopProfessionalsDTO {
  shopId: string;
}

export interface BarbershopProfessionalItem {
  id: string;
  name: string;
  role: string;
  rating: number | null;
  reviewCount: number;
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
    private reviewsRepository?: ReviewsRepository,
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

    // Filtrar membros elegíveis para atendimento (BARBERMAN e OWNER conforme spec D10/D11) com vínculo ativo
    const eligibleMemberships = memberships.filter(
      (m) =>
        (m.role === Role.BARBERMAN || m.role === Role.OWNER) &&
        m.state === "ACTIVE",
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
          rating: null,
          reviewCount: 0,
        });
      }
    }

    if (
      professionals.length > 0 &&
      this.reviewsRepository?.getTargetRatingMetricsBatch
    ) {
      const metricsMap =
        await this.reviewsRepository.getTargetRatingMetricsBatch(
          "BARBER",
          professionals.map((p) => p.id),
        );
      for (const prof of professionals) {
        const metrics = metricsMap.get(prof.id);
        if (metrics && metrics.reviewCount > 0) {
          prof.rating = metrics.averageRating;
          prof.reviewCount = metrics.reviewCount;
        }
      }
    }

    return right({ professionals });
  }
}
