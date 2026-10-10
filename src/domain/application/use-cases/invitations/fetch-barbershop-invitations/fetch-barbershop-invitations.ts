import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { FetchBarbershopInvitationsDTO } from "./fetch-barbershop-invitations-dto";
import type { FetchBarbershopInvitationsResponse } from "./fetch-barbershop-invitations-response";

type FetchBarbershopInvitationsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  FetchBarbershopInvitationsResponse
>;

export class FetchBarbershopInvitationsUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private invitationsRepository: InvitationsRepository,
  ) {}

  async execute({
    barbershopId,
    userId,
  }: FetchBarbershopInvitationsDTO): Promise<FetchBarbershopInvitationsUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.ownerId.toString() !== userId) {
      return left(new NotAllowedError());
    }

    const invitations =
      await this.invitationsRepository.findManyByBarbershopId(barbershopId);

    return right({
      invitations: invitations.map((invitation) => ({
        id: invitation.id.toString(),
        email: invitation.email,
        status: invitation.status,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        respondedAt: invitation.respondedAt ?? null,
        createdAt: invitation.createdAt ?? null,
      })),
    });
  }
}
