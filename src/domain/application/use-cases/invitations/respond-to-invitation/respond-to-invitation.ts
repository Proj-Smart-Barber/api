import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";

export type InvitationReference =
  | { kind: "id"; invitationId: string }
  | { kind: "token"; token: string };

export interface RespondToInvitationDTO {
  userId: string;
  action: "ACCEPT" | "DECLINE";
  reference: InvitationReference;
}

export type RespondToInvitationResponse =
  | {
      invitationId: string;
      barbershopId: string;
      barbermanId: string;
      status: string;
    }
  | {
      invitationId: string;
      status: string;
    };

export type RespondToInvitationUseCaseResponse = Either<
  InvalidInvitationError | AlreadyAMemberError,
  RespondToInvitationResponse
>;

export class RespondToInvitationUseCase {
  constructor(
    private invitationsRepository: InvitationsRepository,
    private usersRepository: UsersRepository,
    private membershipsRepository: MembershipsRepository,
  ) {}

  async execute({
    userId,
    action,
    reference,
  }: RespondToInvitationDTO): Promise<RespondToInvitationUseCaseResponse> {
    const invitation =
      reference.kind === "id"
        ? await this.invitationsRepository.findById(reference.invitationId)
        : await this.invitationsRepository.findByTokenHash(
            hashToken(reference.token),
          );

    if (!invitation) {
      return left(new InvalidInvitationError());
    }

    const user = await this.usersRepository.findById(userId);

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return left(new InvalidInvitationError());
    }

    if (!invitation.canBeRespondedTo()) {
      return left(new InvalidInvitationError());
    }

    if (action === "DECLINE") {
      invitation.markDeclined();
      await this.invitationsRepository.save(invitation);

      return right({
        invitationId: invitation.id.toString(),
        status: invitation.status,
      });
    }

    // Action is ACCEPT
    const existingMembership =
      await this.membershipsRepository.findByBarbershopAndUser(
        invitation.barbershopId.toString(),
        user.id.toString(),
      );

    if (existingMembership && existingMembership.state === "ACTIVE") {
      return left(new AlreadyAMemberError());
    }

    // Promove CLIENT para BARBER mantendo OWNER se já for OWNER
    let userToPromote: typeof user | undefined;
    if (user.accountType === "CLIENT") {
      user.promoteToBarber();
      userToPromote = user;
    }

    let targetMembership: Membership;
    if (existingMembership) {
      existingMembership.reactivate(new Date());
      targetMembership = existingMembership;
    } else {
      targetMembership = Membership.create({
        role: Role.BARBERMAN,
        barbershopId: invitation.barbershopId,
        userId: user.id,
      });
    }

    invitation.markAccepted();

    try {
      await this.membershipsRepository.acceptInvitation(
        invitation,
        targetMembership,
        userToPromote,
      );
    } catch (err) {
      if (err instanceof InvalidInvitationError) {
        return left(err);
      }
      throw err;
    }

    return right({
      invitationId: invitation.id.toString(),
      barbershopId: invitation.barbershopId.toString(),
      barbermanId: user.id.toString(),
      status: invitation.status,
    });
  }
}
