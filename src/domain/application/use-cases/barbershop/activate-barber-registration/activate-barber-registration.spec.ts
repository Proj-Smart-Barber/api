import { describe, expect, it, beforeEach } from "vitest";
import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { BarberRegistration } from "../../../../enterprise/entities/barber-registration";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryBarberRegistrationsRepository } from "../../../../../../test/repositories/in-memory-barber-registrations-repository";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { AccountAlreadyExistsError } from "../../_errors/account-already-exists-error";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import { ActivateBarberRegistrationUseCase } from "./activate-barber-registration";

describe("ActivateBarberRegistrationUseCase", () => {
  let barberRegistrationsRepository: InMemoryBarberRegistrationsRepository;
  let invitationsRepository: InMemoryInvitationsRepository;
  let usersRepository: InMemoryUsersRepository;
  let sut: ActivateBarberRegistrationUseCase;

  const rawToken = "super-secret-token";
  const tokenHash = hashToken(rawToken);

  beforeEach(() => {
    barberRegistrationsRepository =
      new InMemoryBarberRegistrationsRepository();
    invitationsRepository = new InMemoryInvitationsRepository();
    usersRepository = new InMemoryUsersRepository();

    sut = new ActivateBarberRegistrationUseCase(
      barberRegistrationsRepository,
      invitationsRepository,
      usersRepository,
    );
  });

  it("ativa novo barbeiro definindo senha e criando usuário com e-mail verificado", async () => {
    const registration = BarberRegistration.create({
      barbershopId: new UniqueEntityId("shop-1"),
      invitationId: new UniqueEntityId("inv-1"),
      name: "João da Silva",
      cpf: "12345678901",
      email: "joao@example.com",
      tokenHash,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await barberRegistrationsRepository.create(registration);

    const result = await sut.execute({
      token: rawToken,
      password: "novasenhaforte123",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("COMPLETED");
      expect(result.value.email).toBe("joao@example.com");
    }

    const createdUser = await usersRepository.findByEmail("joao@example.com");
    expect(createdUser).not.toBeNull();
    expect(createdUser?.name).toBe("João da Silva");
    expect(createdUser?.cpf).toBe("12345678901");
    expect(createdUser?.accountType).toBe("CLIENT"); // Promoted on acceptance, not on activation
    expect(createdUser?.isEmailVerified).toBe(true);
  });

  it("rejeita nova senha e orienta login caso a conta já exista", async () => {
    const existing = User.create({
      name: "Já Existe",
      email: "existente@example.com",
      cpf: "99988877766",
      password: Password.create("hash-antigo"),
    });
    await usersRepository.save(existing);

    const registration = BarberRegistration.create({
      barbershopId: new UniqueEntityId("shop-1"),
      invitationId: new UniqueEntityId("inv-2"),
      name: "Já Existe",
      cpf: "99988877766",
      email: "existente@example.com",
      tokenHash,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await barberRegistrationsRepository.create(registration);

    const result = await sut.execute({
      token: rawToken,
      password: "tentando-trocar-senha",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(AccountAlreadyExistsError);

    const userAfter = await usersRepository.findByEmail("existente@example.com");
    expect(userAfter?.password.toString()).toBe("hash-antigo");
  });

  it("rejeita token inválido ou expirado", async () => {
    const result = await sut.execute({
      token: "invalid-token",
      password: "qualquersenha123",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidInvitationError);
  });
});
