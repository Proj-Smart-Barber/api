import { type Either, left, right } from "../../../../../core/logic/either";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import { RespondToInvitationUseCase } from "../respond-to-invitation/respond-to-invitation";
import type { DeclineInvitationDTO } from "./decline-invitation-dto";
import type { DeclineInvitationResponse } from "./decline-invitation-response";

type DeclineInvitationUseCaseResponse = Either<
  InvalidInvitationError,
  DeclineInvitationResponse
>;

export class DeclineInvitationUseCase {
  private respondToInvitation: RespondToInvitationUseCase;

  constructor(
    private invitationsRepository: InvitationsRepository,
    private usersRepository: UsersRepository,
    private membershipsRepository?: MembershipsRepository,
  ) {
    this.respondToInvitation = new RespondToInvitationUseCase(
      invitationsRepository,
      usersRepository,
      membershipsRepository ?? ({} as any),
    );
  }

  async execute({
    token,
    userId,
  }: DeclineInvitationDTO): Promise<DeclineInvitationUseCaseResponse> {
    const result = await this.respondToInvitation.execute({
      userId,
      action: "DECLINE",
      reference: { kind: "token", token },
    });

    if (result.isLeft()) {
      return left(result.value as any);
    }

    return right(result.value as DeclineInvitationResponse);
  }
}
