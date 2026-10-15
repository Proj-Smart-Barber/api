import { describe, expect, it, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import {
  Membership,
  Role,
} from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { FakeEmailService } from "../../../../../../test/fakes/fake-email-service";
import { InMemoryBarberRegistrationsRepository } from "../../../../../../test/repositories/in-memory-barber-registrations-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { IdentityConflictError } from "../../_errors/identity-conflict-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { CreateBarberRegistrationUseCase } from "./create-barber-registration";

describe("CreateBarberRegistrationUseCase - Matriz de Identidade", () => {
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let usersRepository: InMemoryUsersRepository;
  let invitationsRepository: InMemoryInvitationsRepository;
  let barberRegistrationsRepository: InMemoryBarberRegistrationsRepository;
  let emailService: FakeEmailService;
  let sut: CreateBarberRegistrationUseCase;

  const ownerId = new UniqueEntityId("owner-id");
  const shopId = new UniqueEntityId("shop-id");

  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    usersRepository = new InMemoryUsersRepository();
    invitationsRepository = new InMemoryInvitationsRepository();
    barberRegistrationsRepository = new InMemoryBarberRegistrationsRepository();
    emailService = new FakeEmailService();

    sut = new CreateBarberRegistrationUseCase(
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
      invitationsRepository,
      barberRegistrationsRepository,
      emailService,
    );

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Modelo",
        ownerId,
        slug: Slug.create("modelo"),
        cnpj: "12345678000100",
        location: "Av Paulista",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      shopId,
    );
    barbershopsRepository.items.push(barbershop);

    await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: ownerId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    const ownerUser = User.create(
      {
        name: "Proprietário",
        email: "owner@modelo.com",
        cpf: "00011122233",
        password: Password.create("hash-owner"),
        accountType: "OWNER",
      },
      ownerId,
    );
    await usersRepository.save(ownerUser);
  });

  it("Caso a) CPF e e-mail novos: cria registro pendente e convite sem exigir login prévio", async () => {
    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      name: "Novo Barbeiro",
      cpf: "111.222.333-44",
      email: "novo.barbeiro@example.com",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("PENDING");
      expect(result.value.requiresExistingAccountLogin).toBe(false);
      expect(result.value.email).toBe("novo.barbeiro@example.com");
    }

    expect(barberRegistrationsRepository.items).toHaveLength(1);
    expect(invitationsRepository.items).toHaveLength(1);
    expect(barberRegistrationsRepository.items[0].cpf).toBe("11122233344");
    // Nenhuma conta de usuário ativa/criada antes do aceite
    const createdUser = await usersRepository.findByEmail("novo.barbeiro@example.com");
    expect(createdUser).toBeNull();
  });

  it("Caso b) CPF e e-mail da mesma conta existente: preserva credenciais e instrui login", async () => {
    const originalPasswordHash = "hash-original-cliente";
    const existingClient = User.create({
      name: "Cliente Existente",
      email: "cliente@example.com",
      cpf: "22233344455",
      password: Password.create(originalPasswordHash),
      accountType: "CLIENT",
    });
    await usersRepository.save(existingClient);

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      name: "Tentativa de Renomear",
      cpf: "222.333.444-55",
      email: "cliente@example.com",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("PENDING");
      expect(result.value.requiresExistingAccountLogin).toBe(true);
    }

    // A senha e os dados do cliente não foram alterados
    const userAfter = await usersRepository.findById(existingClient.id.toString());
    expect(userAfter?.password.toString()).toBe(originalPasswordHash);
    expect(userAfter?.name).toBe("Cliente Existente");
  });

  it("Caso c) CPF existente com e-mail divergente: rejeita com erro de conflito sem vazar dados", async () => {
    const user = User.create({
      name: "Fulano",
      email: "email.cadastrado@example.com",
      cpf: "33344455566",
      password: Password.create("hash"),
    });
    await usersRepository.save(user);

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      name: "Outro Nome",
      cpf: "333.444.555-66",
      email: "email.outro@example.com",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(IdentityConflictError);
  });

  it("Caso d) E-mail existente com CPF diferente: rejeita com erro de conflito sem vazar dados", async () => {
    const user = User.create({
      name: "Ciclano",
      email: "ciclano@example.com",
      cpf: "44455566677",
      password: Password.create("hash"),
    });
    await usersRepository.save(user);

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      name: "Ciclano",
      cpf: "999.888.777-66",
      email: "ciclano@example.com",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(IdentityConflictError);
  });

  it("Caso e) CPF e e-mail de contas diferentes: rejeita com erro de conflito", async () => {
    const user1 = User.create({
      name: "User 1",
      email: "user1@example.com",
      cpf: "11111111111",
      password: Password.create("hash1"),
    });
    const user2 = User.create({
      name: "User 2",
      email: "user2@example.com",
      cpf: "22222222222",
      password: Password.create("hash2"),
    });
    await usersRepository.save(user1);
    await usersRepository.save(user2);

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      name: "Mix",
      cpf: "111.111.111-11",
      email: "user2@example.com",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(IdentityConflictError);
  });

  it("impede cadastrar membro que já está ATIVO na mesma unidade", async () => {
    const existingBarber = User.create({
      name: "Barbeiro da Casa",
      email: "barbeiro@modelo.com",
      cpf: "55566677788",
      password: Password.create("hash"),
      accountType: "BARBER",
    });
    await usersRepository.save(existingBarber);

    await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: existingBarber.id,
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      name: "Barbeiro da Casa",
      cpf: "555.666.777-88",
      email: "barbeiro@modelo.com",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(AlreadyAMemberError);
  });

  it("rejeita se o ator não for OWNER ACTIVE da unidade", async () => {
    const otherUser = User.create({
      name: "Outro Usuário",
      email: "outro@modelo.com",
      cpf: "77788899900",
      password: Password.create("hash"),
    });
    await usersRepository.save(otherUser);

    const result = await sut.execute({
      actorId: otherUser.id.toString(),
      shopId: shopId.toString(),
      name: "Barbeiro",
      cpf: "123.456.789-01",
      email: "barbeiro@teste.com",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
