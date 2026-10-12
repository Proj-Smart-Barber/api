import { type Either, left, right } from "../../../../../core/logic/either";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import type { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import { RespondToInvitationUseCase } from "../respond-to-invitation/respond-to-invitation";
import type { AcceptInvitationDTO } from "./accept-invitation-dto";
import type { AcceptInvitationResponse } from "./accept-invitation-response";

type AcceptInvitationUseCaseResponse = Either<
  InvalidInvitationError | AlreadyAMemberError,
  AcceptInvitationResponse
>;

export class AcceptInvitationUseCase {
  private respondToInvitation: RespondToInvitationUseCase;

  constructor(
    private invitationsRepository: InvitationsRepository,
    private usersRepository: UsersRepository,
    private membershipsRepository: MembershipsRepository,
  ) {
    this.respondToInvitation = new RespondToInvitationUseCase(
      invitationsRepository,
      usersRepository,
      membershipsRepository,
    );
  }

  async execute({
    token,
    userId,
  }: AcceptInvitationDTO): Promise<AcceptInvitationUseCaseResponse> {
    const result = await this.respondToInvitation.execute({
      userId,
      action: "ACCEPT",
      reference: { kind: "token", token },
    });

    if (result.isLeft()) {
      return left(result.value);
    }

    return right(result.value as AcceptInvitationResponse);
  }
}
