import { type Either, left, right } from "../../../../../core/logic/either";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { FetchBarbershopInvitationsDTO } from "./fetch-barbershop-invitations-dto";
import type {
  BarbershopInvitationItem,
  FetchBarbershopInvitationsResponse,
} from "./fetch-barbershop-invitations-response";

type FetchBarbershopInvitationsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  FetchBarbershopInvitationsResponse
>;

export class FetchBarbershopInvitationsUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private invitationsRepository: InvitationsRepository,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async execute({
    barbershopId,
    userId,
    page = 1,
    limit = 20,
  }: FetchBarbershopInvitationsDTO): Promise<FetchBarbershopInvitationsUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (this.membershipsRepository) {
      const actorMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          barbershopId,
          userId,
        );

      if (
        !actorMembership ||
        actorMembership.role !== Role.OWNER ||
        actorMembership.state !== "ACTIVE"
      ) {
        return left(
          new NotAllowedError(
            "Apenas o proprietário ativo da unidade pode listar os convites.",
          ),
        );
      }
    } else if (barbershop.ownerId.toString() !== userId) {
      return left(new NotAllowedError());
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    let invitationItems: BarbershopInvitationItem[] = [];
    let total = 0;

    if (this.invitationsRepository.findManyByBarbershopIdPaginated) {
      const result =
        await this.invitationsRepository.findManyByBarbershopIdPaginated(
          barbershopId,
          {
            page: safePage,
            limit: safeLimit,
          },
        );
      total = result.total;
      invitationItems = result.items.map((invitation) => ({
        id: invitation.id.toString(),
        email: invitation.email,
        status: invitation.status,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        respondedAt: invitation.respondedAt ?? null,
        createdAt: invitation.createdAt ?? null,
      }));
    } else {
      const all =
        await this.invitationsRepository.findManyByBarbershopId(barbershopId);
      total = all.length;
      invitationItems = all
        .slice((safePage - 1) * safeLimit, safePage * safeLimit)
        .map((invitation) => ({
          id: invitation.id.toString(),
          email: invitation.email,
          status: invitation.status,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          respondedAt: invitation.respondedAt ?? null,
          createdAt: invitation.createdAt ?? null,
        }));
    }

    const hasNext = safePage * safeLimit < total;
    const serverTime = new Date().toISOString();

    return right({
      items: invitationItems,
      invitations: invitationItems,
      page: safePage,
      limit: safeLimit,
      total,
      hasNext,
      serverTime,
    });
  }
}
