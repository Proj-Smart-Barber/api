import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { type Either, left, right } from "../../../../../core/logic/either";
import { BarberRegistration } from "../../../../enterprise/entities/barber-registration";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Role } from "../../../../enterprise/entities/membership";
import { Notification } from "../../../../enterprise/entities/notification";
import type { BarberRegistrationsRepository } from "../../../repositories/barber-registrations-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { EmailService } from "../../../services/email-service";
import {
  buildInvitationUrl,
  createInvitationToken,
} from "../../../services/invitation-token-service";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { EmailSendError } from "../../_errors/email-send-error";
import { IdentityConflictError } from "../../_errors/identity-conflict-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { PendingInvitationAlreadyExistsError } from "../../_errors/pending-invitation-already-exists-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface CreateBarberRegistrationDTO {
  actorId: string;
  shopId: string;
  name: string;
  cpf: string;
  email: string;
}

export interface CreateBarberRegistrationResponse {
  registrationId: string;
  invitationId: string;
  email: string;
  status: "PENDING";
  requiresExistingAccountLogin: boolean;
  expiresAt: string;
}

export type CreateBarberRegistrationUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | IdentityConflictError
  | AlreadyAMemberError
  | PendingInvitationAlreadyExistsError
  | EmailSendError
  | Error,
  CreateBarberRegistrationResponse
>;

export class CreateBarberRegistrationUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
    private usersRepository: UsersRepository,
    private invitationsRepository: InvitationsRepository,
    private barberRegistrationsRepository: BarberRegistrationsRepository,
    private emailService: EmailService,
    private notificationsRepository?: NotificationsRepository,
  ) {}

  async execute({
    actorId,
    shopId,
    name,
    cpf,
    email,
  }: CreateBarberRegistrationDTO): Promise<CreateBarberRegistrationUseCaseResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.status !== "ACTIVE") {
      return left(new ResourceNotFoundError("Barbearia inativa."));
    }

    const actorMembership =
      await this.membershipsRepository.findByBarbershopAndUser(shopId, actorId);

    if (
      !actorMembership ||
      actorMembership.role !== Role.OWNER ||
      actorMembership.state !== "ACTIVE"
    ) {
      return left(
        new NotAllowedError(
          "Apenas o proprietário ativo da unidade pode iniciar o cadastro profissional.",
        ),
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCpf = cpf.replace(/\D/g, "");

    if (cleanCpf.length !== 11) {
      return left(new Error("CPF deve conter exatamente 11 dígitos."));
    }

    // 1. Consulta matriz de identidade
    const userByEmail = await this.usersRepository.findByEmail(normalizedEmail);
    const userByCpf = await this.usersRepository.findByCpf(cleanCpf);

    // Casos c, d, e: conflito de identidade entre contas
    const hasConflict =
      (userByCpf && !userByEmail) ||
      (userByEmail && !userByCpf) ||
      (userByEmail &&
        userByCpf &&
        userByEmail.id.toString() !== userByCpf.id.toString());

    if (hasConflict) {
      return left(new IdentityConflictError());
    }

    const isExistingUser =
      userByEmail &&
      userByCpf &&
      userByEmail.id.toString() === userByCpf.id.toString();

    // Se a conta já existe, verifica se já é membro ativo desta unidade
    if (isExistingUser) {
      const membership =
        await this.membershipsRepository.findByBarbershopAndUser(
          shopId,
          userByEmail.id.toString(),
        );

      if (membership && membership.state === "ACTIVE") {
        return left(new AlreadyAMemberError());
      }
    }

    // Verifica se já existe convite pendente
    const existingInvitation =
      await this.invitationsRepository.findByBarbershopIdAndEmail(
        shopId,
        normalizedEmail,
      );

    if (existingInvitation?.canBeRespondedTo()) {
      return left(new PendingInvitationAlreadyExistsError());
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
      invitedById: new UniqueEntityId(actorId),
    });

    await this.invitationsRepository.create(invitation);

    const registration = BarberRegistration.create({
      barbershopId: barbershop.id,
      invitationId: invitation.id,
      name: isExistingUser ? userByEmail.name : name.trim(),
      cpf: cleanCpf,
      email: normalizedEmail,
      tokenHash,
      status: "PENDING",
      expiresAt,
    });

    await this.barberRegistrationsRepository.create(registration);

    const owner = await this.usersRepository.findById(actorId);
    const ownerName = owner?.name ?? barbershop.name;

    let createdNotification: Notification | null = null;
    if (isExistingUser && this.notificationsRepository) {
      createdNotification = await this.notificationsRepository.create(
        Notification.create({
          userId: userByEmail.id,
          type: "INVITATION_RECEIVED",
          title: `Convite para ${barbershop.name}`,
          message: `${ownerName} cadastrou seu perfil profissional e convidou você para a ${barbershop.name}.`,
          referenceType: "INVITATION",
          referenceId: invitation.id,
          scheduledAt: new Date(),
          sentAt: new Date(),
        }),
      );
    }

    try {
      await this.emailService.sendInvitationEmail({
        to: normalizedEmail,
        ownerName,
        barbershopName: barbershop.name,
        invitationUrl: buildInvitationUrl(plainToken),
        expiresInDays,
      });
    } catch {
      if (createdNotification && this.notificationsRepository) {
        await this.notificationsRepository.delete(
          createdNotification.id.toString(),
        );
      }
      await this.invitationsRepository.delete(invitation.id.toString());
      return left(new EmailSendError());
    }

    return right({
      registrationId: registration.id.toString(),
      invitationId: invitation.id.toString(),
      email: normalizedEmail,
      status: "PENDING",
      requiresExistingAccountLogin: Boolean(isExistingUser),
      expiresAt: expiresAt.toISOString(),
    });
  }
}
