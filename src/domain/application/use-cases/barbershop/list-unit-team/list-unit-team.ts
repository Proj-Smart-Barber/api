import { type Either, left, right } from "../../../../../core/logic/either";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface ListUnitTeamDTO {
  actorId: string;
  shopId: string;
  state?: "ACTIVE" | "INACTIVE";
  page?: number;
  limit?: number;
}

export interface TeamMemberDto {
  membershipId: string;
  userId: string;
  name: string;
  role: string;
  state: "ACTIVE" | "INACTIVE";
  version: number;
  joinedAt: string;
  endedAt?: string | null;
  avatarUrl?: string | null;
}

export interface ListUnitTeamResponse {
  items: TeamMemberDto[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  serverTime: string;
}

type ListUnitTeamUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  ListUnitTeamResponse
>;

export class ListUnitTeamUseCase {
  constructor(
    private membershipsRepository: MembershipsRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    actorId,
    shopId,
    state,
    page = 1,
    limit = 20,
  }: ListUnitTeamDTO): Promise<ListUnitTeamUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    const actorMembership =
      await this.membershipsRepository.findByBarbershopAndUser(shopId, actorId);

    if (
      !actorMembership ||
      actorMembership.role !== Role.OWNER ||
      actorMembership.state !== "ACTIVE"
    ) {
      return left(
        new NotAllowedError(
          "Apenas o proprietário ativo da unidade pode listar a equipe.",
        ),
      );
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const result =
      await this.membershipsRepository.findManyByBarbershopIdWithDetails(
        shopId,
        {
          state,
          page: safePage,
          limit: safeLimit,
        },
      );

    const items: TeamMemberDto[] = result.items.map((item) => ({
      membershipId: item.membership.id.toString(),
      userId: item.user.id,
      name: item.user.name,
      role: item.membership.role,
      state: item.membership.state,
      version: item.membership.version,
      joinedAt:
        item.membership.createdAt?.toISOString() ?? new Date().toISOString(),
      endedAt: item.membership.endedAt?.toISOString() ?? null,
      avatarUrl: item.user.avatarUrl ?? null,
    }));

    const hasNext = safePage * safeLimit < result.total;
    const serverTime = new Date().toISOString();

    return right({
      items,
      page: safePage,
      limit: safeLimit,
      total: result.total,
      hasNext,
      serverTime,
    });
  }
}
