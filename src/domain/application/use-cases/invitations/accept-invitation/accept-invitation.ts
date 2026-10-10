import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import type { AcceptInvitationDTO } from "./accept-invitation-dto";
import type { AcceptInvitationResponse } from "./accept-invitation-response";

type AcceptInvitationUseCaseResponse = Either<
  InvalidInvitationError | AlreadyAMemberError,
  AcceptInvitationResponse
>;

export class AcceptInvitationUseCase {
  constructor(
    private invitationsRepository: InvitationsRepository,
    private usersRepository: UsersRepository,
    private membershipsRepository: MembershipsRepository,
  ) {}

  async execute({
    token,
    userId,
  }: AcceptInvitationDTO): Promise<AcceptInvitationUseCaseResponse> {
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

    const existingMembership =
      await this.membershipsRepository.findByBarbershopAndUser(
        invitation.barbershopId.toString(),
        user.id.toString(),
      );

    if (existingMembership) {
      return left(new AlreadyAMemberError());
    }

    const membership = Membership.create({
      role: Role.BARBERMAN,
      barbershopId: invitation.barbershopId,
      userId: user.id,
    });

    invitation.markAccepted();

    await this.membershipsRepository.acceptInvitation(invitation, membership);

    return right({
      invitationId: invitation.id.toString(),
      barbershopId: invitation.barbershopId.toString(),
      barbermanId: user.id.toString(),
      status: invitation.status,
    });
  }
}
