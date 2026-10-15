import { describe, expect, it, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Invitation } from "../../../../enterprise/entities/invitation";
import {
  Membership,
  Role,
} from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { FakeEmailService } from "../../../../../../test/fakes/fake-email-service";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { InMemoryBarberRegistrationsRepository } from "../../../../../../test/repositories/in-memory-barber-registrations-repository";
import { BarberRegistration } from "../../../../enterprise/entities/barber-registration";
import {
  ResendInvitationUseCase,
  ResendCooldownError,
} from "./resend-invitation";

describe("ResendInvitationUseCase", () => {
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let invitationsRepository: InMemoryInvitationsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let usersRepository: InMemoryUsersRepository;
  let barberRegistrationsRepository: InMemoryBarberRegistrationsRepository;
  let emailService: FakeEmailService;
  let sut: ResendInvitationUseCase;

  beforeEach(() => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    invitationsRepository = new InMemoryInvitationsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    usersRepository = new InMemoryUsersRepository();
    barberRegistrationsRepository = new InMemoryBarberRegistrationsRepository();
    emailService = new FakeEmailService();

    sut = new ResendInvitationUseCase(
      barbershopsRepository,
      invitationsRepository,
      membershipsRepository,
      usersRepository,
      emailService,
      barberRegistrationsRepository,
    );
  });

  it("permite ao proprietário ativo reenviar convite após o cooldown", async () => {
    const ownerId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Top",
        ownerId,
        slug: Slug.create("top"),
        cnpj: "11111111000199",
        location: "Rua 1",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      barbershopId,
    );
    barbershopsRepository.items.push(barbershop);

    await membershipsRepository.create(
      Membership.create({
        barbershopId,
        userId: ownerId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    const ownerUser = User.create(
      {
        name: "Proprietário Top",
        email: "owner@top.com",
        cpf: "11122233344",
        password: Password.create("hash"),
        accountType: "OWNER",
      },
      ownerId,
    );
    await usersRepository.save(ownerUser);

    // Convite criado há 2 minutos (passou o cooldown de 60s)
    const invitation = Invitation.create({
      barbershopId,
      email: "barber@top.com",
      role: Role.BARBERMAN,
      tokenHash: "old-hash",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      invitedById: ownerId,
      createdAt: new Date(Date.now() - 120_000),
    });
    await invitationsRepository.create(invitation);

    const result = await sut.execute({
      barbershopId: barbershopId.toString(),
      invitationId: invitation.id.toString(),
      userId: ownerId.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.invitationId).toBe(invitation.id.toString());
      expect(invitation.tokenHash).not.toBe("old-hash");
    }
  });

  it("rejeita reenvio se o cooldown de 60s ainda estiver ativo", async () => {
    const ownerId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Top",
        ownerId,
        slug: Slug.create("top"),
        cnpj: "11111111000199",
        location: "Rua 1",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      barbershopId,
    );
    barbershopsRepository.items.push(barbershop);

    await membershipsRepository.create(
      Membership.create({
        barbershopId,
        userId: ownerId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    // Convite criado há 10 segundos
    const invitation = Invitation.create({
      barbershopId,
      email: "barber@top.com",
      role: Role.BARBERMAN,
      tokenHash: "old-hash",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      invitedById: ownerId,
      createdAt: new Date(Date.now() - 10_000),
    });
    await invitationsRepository.create(invitation);

    const result = await sut.execute({
      barbershopId: barbershopId.toString(),
      invitationId: invitation.id.toString(),
      userId: ownerId.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResendCooldownError);
  });

  it("sincroniza o tokenHash de barber_registrations associado ao convite reenviado", async () => {
    const ownerId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Top",
        ownerId,
        slug: Slug.create("top-sync"),
        cnpj: "11111111000199",
        location: "Rua 1",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      barbershopId,
    );
    barbershopsRepository.items.push(barbershop);

    await membershipsRepository.create(
      Membership.create({
        barbershopId,
        userId: ownerId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    const ownerUser = User.create(
      {
        name: "Proprietário",
        email: "owner-sync@top.com",
        cpf: "11144477735",
        password: Password.create("hash"),
        accountType: "OWNER",
      },
      ownerId,
    );
    await usersRepository.save(ownerUser);

    const invitation = Invitation.create({
      barbershopId,
      email: "barber-sync@top.com",
      role: Role.BARBERMAN,
      tokenHash: "old-invitation-hash",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      invitedById: ownerId,
      createdAt: new Date(Date.now() - 120_000),
    });
    await invitationsRepository.create(invitation);

    const registration = BarberRegistration.create({
      barbershopId,
      invitationId: invitation.id,
      name: "Barbeiro Sincronizado",
      cpf: "52998224725",
      email: "barber-sync@top.com",
      tokenHash: "old-invitation-hash",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await barberRegistrationsRepository.create(registration);

    const result = await sut.execute({
      barbershopId: barbershopId.toString(),
      invitationId: invitation.id.toString(),
      userId: ownerId.toString(),
    });

    expect(result.isRight()).toBe(true);
    const updatedRegistration = await barberRegistrationsRepository.findByInvitationId(
      invitation.id.toString(),
    );
    expect(updatedRegistration).not.toBeNull();
    expect(updatedRegistration?.tokenHash).toBe(invitation.tokenHash);
    expect(updatedRegistration?.tokenHash).not.toBe("old-invitation-hash");
  });
});
