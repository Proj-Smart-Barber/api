import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { FetchUserInvitationsDTO } from "./fetch-user-invitations-dto";
import type { FetchUserInvitationsResponse } from "./fetch-user-invitations-response";

type FetchUserInvitationsUseCaseResponse = Either<
  ResourceNotFoundError,
  FetchUserInvitationsResponse
>;

export class FetchUserInvitationsUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private invitationsRepository: InvitationsRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    userId,
  }: FetchUserInvitationsDTO): Promise<FetchUserInvitationsUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError());
    }

    const invitations = await this.invitationsRepository.findPendingByEmail(
      user.email,
    );

    const items = [];

    for (const invitation of invitations) {
      const barbershop = await this.barbershopsRepository.findById(
        invitation.barbershopId.toString(),
      );

      items.push({
        id: invitation.id.toString(),
        barbershopId: invitation.barbershopId.toString(),
        barbershopName: barbershop?.name ?? null,
        status: invitation.status,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt ?? null,
      });
    }

    return right({ invitations: items });
  }
}
