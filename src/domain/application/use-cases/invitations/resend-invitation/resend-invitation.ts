import { type Either, left, right } from "../../../../../core/logic/either";
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
import { EmailSendError } from "../../_errors/email-send-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface ResendInvitationDTO {
  barbershopId: string;
  invitationId: string;
  userId: string;
}

export interface ResendInvitationResponse {
  invitationId: string;
  sentAt: string;
  expiresAt: string;
}

export class ResendCooldownError extends Error {
  public readonly code = "RESEND_COOLDOWN";

  constructor(
    message = "Aguarde 60 segundos antes de reenviar este convite.",
  ) {
    super(message);
    this.name = "ResendCooldownError";
  }
}

type ResendInvitationUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | ResendCooldownError
  | EmailSendError
  | Error,
  ResendInvitationResponse
>;

export class ResendInvitationUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private invitationsRepository: InvitationsRepository,
    private membershipsRepository: MembershipsRepository,
    private usersRepository: UsersRepository,
    private emailService: EmailService,
  ) {}

  async execute({
    barbershopId,
    invitationId,
    userId,
  }: ResendInvitationDTO): Promise<ResendInvitationUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(barbershopId);

    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.status !== "ACTIVE") {
      return left(new ResourceNotFoundError("Barbearia inativa."));
    }

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
          "Apenas o proprietário ativo da unidade pode reenviar convites.",
        ),
      );
    }

    const invitation = await this.invitationsRepository.findById(invitationId);

    if (!invitation || invitation.barbershopId.toString() !== barbershopId) {
      return left(new ResourceNotFoundError("Convite não encontrado."));
    }

    if (!invitation.isPending()) {
      return left(
        new Error("Apenas convites pendentes e não expirados podem ser reenviados."),
      );
    }

    // Cooldown check: 60s
    const createdAtTime = invitation.createdAt?.getTime() ?? 0;
    const now = Date.now();
    if (now - createdAtTime < 60_000) {
      return left(new ResendCooldownError());
    }

    const owner = await this.usersRepository.findById(userId);
    if (!owner) {
      return left(new ResourceNotFoundError("Proprietário não encontrado."));
    }

    // Refresh token and expiration
    const { plainToken, tokenHash, expiresAt, expiresInDays } =
      createInvitationToken();

    invitation.renew(tokenHash, expiresAt);
    await this.invitationsRepository.save(invitation);

    try {
      await this.emailService.sendInvitationEmail({
        to: invitation.email,
        ownerName: owner.name,
        barbershopName: barbershop.name,
        invitationUrl: buildInvitationUrl(plainToken),
        expiresInDays,
      });
    } catch {
      return left(new EmailSendError());
    }

    return right({
      invitationId: invitation.id.toString(),
      sentAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  }
}
