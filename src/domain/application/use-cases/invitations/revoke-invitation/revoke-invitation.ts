import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { RevokeInvitationDTO } from "./revoke-invitation-dto";
import type { RevokeInvitationResponse } from "./revoke-invitation-response";

type RevokeInvitationUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError | Error,
  RevokeInvitationResponse
>;

export class RevokeInvitationUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private invitationsRepository: InvitationsRepository,
  ) {}

  async execute({
    barbershopId,
    invitationId,
    userId,
  }: RevokeInvitationDTO): Promise<RevokeInvitationUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.ownerId.toString() !== userId) {
      return left(new NotAllowedError());
    }

    const invitation = await this.invitationsRepository.findById(invitationId);

    if (!invitation || invitation.barbershopId.toString() !== barbershopId) {
      return left(new ResourceNotFoundError("Convite não encontrado."));
    }

    if (!invitation.isPending()) {
      return left(new Error("Apenas convites pendentes podem ser revogados."));
    }

    invitation.revoke();
    await this.invitationsRepository.save(invitation);

    return right({
      invitationId: invitation.id.toString(),
      status: invitation.status,
    });
  }
}
