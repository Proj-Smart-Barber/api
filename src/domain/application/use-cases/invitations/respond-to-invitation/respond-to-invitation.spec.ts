import { describe, beforeEach, it, expect } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { RespondToInvitationUseCase } from "./respond-to-invitation";
import { hashToken } from "../../../../../core/crypto/token";

let invitationsRepository: InMemoryInvitationsRepository;
let usersRepository: InMemoryUsersRepository;
let membershipsRepository: InMemoryMembershipsRepository;
let sut: RespondToInvitationUseCase;

describe("Respond to Invitation Use Case (Canonical)", () => {
  beforeEach(() => {
    invitationsRepository = new InMemoryInvitationsRepository();
    usersRepository = new InMemoryUsersRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    sut = new RespondToInvitationUseCase(
      invitationsRepository,
      usersRepository,
      membershipsRepository,
    );
  });

  function createPendingInvitation(
    email: string,
    shopId = "shop-123",
    tokenHash = "fakehash",
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
  ) {
    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId(shopId),
      email,
      role: Role.BARBERMAN,
      tokenHash,
      status: "PENDING",
      expiresAt,
      invitedById: new UniqueEntityId("owner-1"),
    });
    invitationsRepository.items.push(invitation);
    return invitation;
  }

  it("accept_by_id_keeps_user_identity and promotes CLIENT to BARBER", async () => {
    const rawPassword = "password123456";
    const hashedPassword = await Password.generateHashFromPlainText(
      rawPassword,
      10,
    );

    const user = User.create({
      name: "Carlos Barbeiro",
      email: "carlos@barbearia.com",
      password: hashedPassword,
      cpf: "12345678901",
      accountType: "CLIENT",
    });
    await usersRepository.save(user);

    const invitation = createPendingInvitation("carlos@barbearia.com");

    const result = await sut.execute({
      userId: user.id.toString(),
      action: "ACCEPT",
      reference: { kind: "id", invitationId: invitation.id.toString() },
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("ACCEPTED");
    }

    const updatedUser = await usersRepository.findById(user.id.toString());
    expect(updatedUser?.accountType).toBe("BARBER");
    expect(updatedUser?.password).toBe(hashedPassword);
    expect(updatedUser?.cpf).toBe("12345678901");

    const membership = await membershipsRepository.findByBarbershopAndUser(
      "shop-123",
      user.id.toString(),
    );
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe("BARBERMAN");
  });

  it("preserves OWNER role when accepting invitation to another barbershop", async () => {
    const user = User.create({
      name: "Dono Também Barbeiro",
      email: "owner@barbearia.com",
      password: Password.create("hash"),
      cpf: "12345678902",
      accountType: "OWNER",
    });
    await usersRepository.save(user);

    const invitation = createPendingInvitation(
      "owner@barbearia.com",
      "shop-other",
      "fakehash2",
    );

    const result = await sut.execute({
      userId: user.id.toString(),
      action: "ACCEPT",
      reference: { kind: "id", invitationId: invitation.id.toString() },
    });

    expect(result.isRight()).toBe(true);
    const updatedUser = await usersRepository.findById(user.id.toString());
    expect(updatedUser?.accountType).toBe("OWNER");
  });

  it("wrong_recipient_cannot_respond", async () => {
    const user = User.create({
      name: "Outro Usuário",
      email: "outro@barbearia.com",
      password: Password.create("hash"),
      cpf: "12345678903",
    });
    await usersRepository.save(user);

    const invitation = createPendingInvitation(
      "destinatario.original@barbearia.com",
      "shop-123",
      "fakehash3",
    );

    const result = await sut.execute({
      userId: user.id.toString(),
      action: "ACCEPT",
      reference: { kind: "id", invitationId: invitation.id.toString() },
    });

    expect(result.isLeft()).toBe(true);
  });

  it("terminal_or_expired_cannot_respond", async () => {
    const user = User.create({
      name: "Destinatário",
      email: "dest@barbearia.com",
      password: Password.create("hash"),
      cpf: "12345678904",
    });
    await usersRepository.save(user);

    // Expirado
    const expiredInvitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-123"),
      email: "dest@barbearia.com",
      role: Role.BARBERMAN,
      tokenHash: "hash-expired",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 1000),
      invitedById: new UniqueEntityId("owner-1"),
    });
    invitationsRepository.items.push(expiredInvitation);

    const resultExpired = await sut.execute({
      userId: user.id.toString(),
      action: "ACCEPT",
      reference: { kind: "id", invitationId: expiredInvitation.id.toString() },
    });
    expect(resultExpired.isLeft()).toBe(true);

    // Já aceito (terminal)
    const acceptedInvitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-123"),
      email: "dest@barbearia.com",
      role: Role.BARBERMAN,
      tokenHash: "hash-accepted",
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 100000),
      invitedById: new UniqueEntityId("owner-1"),
    });
    invitationsRepository.items.push(acceptedInvitation);

    const resultAccepted = await sut.execute({
      userId: user.id.toString(),
      action: "ACCEPT",
      reference: { kind: "id", invitationId: acceptedInvitation.id.toString() },
    });
    expect(resultAccepted.isLeft()).toBe(true);
  });

  it("token_and_id_share_transition and decline works identically", async () => {
    const user = User.create({
      name: "Destinatário",
      email: "dest@barbearia.com",
      password: Password.create("hash"),
      cpf: "12345678905",
    });
    await usersRepository.save(user);

    const rawToken = "raw-secret-token-123";
    const hashed = hashToken(rawToken);

    const invitation = createPendingInvitation(
      "dest@barbearia.com",
      "shop-123",
      hashed,
    );

    const result = await sut.execute({
      userId: user.id.toString(),
      action: "DECLINE",
      reference: { kind: "token", token: rawToken },
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("DECLINED");
    }

    const saved = await invitationsRepository.findById(
      invitation.id.toString(),
    );
    expect(saved?.status).toBe("DECLINED");
  });

  it("permite reativar membro INACTIVE com novo aceite e incrementa versão", async () => {
    const user = User.create({
      name: "Barbeiro Retornando",
      email: "retorno@barbearia.com",
      password: Password.create("hash"),
      cpf: "12345678909",
      accountType: "BARBER",
    });
    await usersRepository.save(user);

    // Vínculo existente porém INACTIVE
    const previousMembership = Membership.create({
      barbershopId: new UniqueEntityId("shop-123"),
      userId: user.id,
      role: Role.BARBERMAN,
      state: "INACTIVE",
      version: 2,
      endedAt: new Date(),
    });
    await membershipsRepository.create(previousMembership);

    const invitation = createPendingInvitation(
      "retorno@barbearia.com",
      "shop-123",
      "fakehash-retorno",
    );

    const result = await sut.execute({
      userId: user.id.toString(),
      action: "ACCEPT",
      reference: { kind: "id", invitationId: invitation.id.toString() },
    });

    expect(result.isRight()).toBe(true);

    const updatedMembership =
      await membershipsRepository.findByBarbershopAndUser(
        "shop-123",
        user.id.toString(),
      );
    expect(updatedMembership?.state).toBe("ACTIVE");
    expect(updatedMembership?.endedAt).toBeNull();
    expect(updatedMembership?.version).toBe(3);
  });
});
