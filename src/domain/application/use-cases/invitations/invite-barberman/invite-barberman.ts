import { type Either, left, right } from "../../../../../core/logic/either";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { EmailService } from "../../../services/email-service";
import {
  buildInvitationUrl,
  createInvitationToken,
} from "../../../services/invitation-token-service";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { EmailSendError } from "../../_errors/email-send-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { InviteBarbermanDTO } from "./invite-barberman-dto";
import type { InviteBarbermanResponse } from "./invite-barberman-response";

type InviteBarbermanUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | AlreadyAMemberError
  | EmailSendError
  | Error,
  InviteBarbermanResponse
>;

export class InviteBarbermanUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private invitationsRepository: InvitationsRepository,
    private membershipsRepository: MembershipsRepository,
    private usersRepository: UsersRepository,
    private emailService: EmailService,
  ) {}

  async execute({
    barbershopId,
    userId,
    email,
  }: InviteBarbermanDTO): Promise<InviteBarbermanUseCaseResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.status !== "ACTIVE") {
      return left(new ResourceNotFoundError("Barbearia inativa."));
    }

    if (barbershop.ownerId.toString() !== userId) {
      return left(new NotAllowedError());
    }

    const existingUser =
      await this.usersRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      const membership =
        await this.membershipsRepository.findByBarbershopAndUser(
          barbershopId,
          existingUser.id.toString(),
        );

      if (membership) {
        return left(new AlreadyAMemberError());
      }
    }

    const existingInvitation =
      await this.invitationsRepository.findByBarbershopIdAndEmail(
        barbershopId,
        normalizedEmail,
      );

    if (existingInvitation?.canBeRespondedTo()) {
      return left(
        new Error(
          "Já existe um convite pendente para este e-mail nesta barbearia.",
        ),
      );
    }

    const { plainToken, tokenHash, expiresAt, expiresInDays } =
      createInvitationToken();

    const invitation = Invitation.create({
      barbershopId: barbershop.id,
      email: normalizedEmail,
      role: Role.BARBERMAN,
      tokenHash,
      status: "PENDING",
      expiresAt,
      invitedById: barbershop.ownerId,
    });

    await this.invitationsRepository.create(invitation);

    const owner = await this.usersRepository.findById(
      barbershop.ownerId.toString(),
    );

    if (!owner) {
      return left(new ResourceNotFoundError());
    }

    try {
      await this.emailService.sendInvitationEmail({
        to: normalizedEmail,
        ownerName: owner.name,
        barbershopName: barbershop.name,
        invitationUrl: buildInvitationUrl(plainToken, "accept"),
        expiresInDays,
      });
    } catch {
      await this.invitationsRepository.delete(invitation.id.toString());
      return left(new EmailSendError());
    }

    return right({
      invitationId: invitation.id.toString(),
      invitedEmail: normalizedEmail,
      expiresAt,
    });
  }
}
