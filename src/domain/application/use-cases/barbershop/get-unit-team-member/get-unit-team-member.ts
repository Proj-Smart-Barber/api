import { type Either, left, right } from "../../../../../core/logic/either";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { TeamMemberDto } from "../list-unit-team/list-unit-team";

export interface GetUnitTeamMemberDTO {
  actorId: string;
  shopId: string;
  membershipId: string;
}

export type GetUnitTeamMemberResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  TeamMemberDto
>;

export class GetUnitTeamMemberUseCase {
  constructor(
    private membershipsRepository: MembershipsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private usersRepository?: UsersRepository,
  ) {}

  async execute({
    actorId,
    shopId,
    membershipId,
  }: GetUnitTeamMemberDTO): Promise<GetUnitTeamMemberResponse> {
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
          "Apenas o proprietário ativo da unidade pode consultar o detalhe do membro.",
        ),
      );
    }

    const targetMembership =
      await this.membershipsRepository.findById(membershipId);

    if (
      !targetMembership ||
      targetMembership.barbershopId.toString() !== shopId
    ) {
      return left(new ResourceNotFoundError("Membro não encontrado nesta unidade."));
    }

    let userName = "Membro";
    let avatarUrl: string | null = null;

    if (this.usersRepository) {
      const user = await this.usersRepository.findById(
        targetMembership.userId.toString(),
      );
      if (user) {
        userName = user.name;
        avatarUrl = user.avatarUrl ?? null;
      }
    }

    const dto: TeamMemberDto = {
      membershipId: targetMembership.id.toString(),
      userId: targetMembership.userId.toString(),
      name: userName,
      role: targetMembership.role,
      state: targetMembership.state,
      version: targetMembership.version,
      joinedAt:
        targetMembership.createdAt?.toISOString() ?? new Date().toISOString(),
      endedAt: targetMembership.endedAt?.toISOString() ?? null,
      avatarUrl,
    };

    return right(dto);
  }
}
