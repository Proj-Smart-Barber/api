import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import type { DeclineInvitationDTO } from "./decline-invitation-dto";
import type { DeclineInvitationResponse } from "./decline-invitation-response";

type DeclineInvitationUseCaseResponse = Either<
  InvalidInvitationError,
  DeclineInvitationResponse
>;

export class DeclineInvitationUseCase {
  constructor(
    private invitationsRepository: InvitationsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute({
    token,
    userId,
  }: DeclineInvitationDTO): Promise<DeclineInvitationUseCaseResponse> {
    const invitation = await this.invitationsRepository.findByTokenHash(
      hashToken(token),
    );

    if (!invitation) {
      return left(new InvalidInvitationError());
    }

    const user = await this.usersRepository.findById(userId);

    if (!user || user.email.toLowerCase() !== invitation.email) {
      return left(new InvalidInvitationError());
    }

    if (!invitation.canBeRespondedTo()) {
      return left(new InvalidInvitationError());
    }

    invitation.markDeclined();
    await this.invitationsRepository.save(invitation);

    return right({
      invitationId: invitation.id.toString(),
      status: invitation.status,
    });
  }
}
