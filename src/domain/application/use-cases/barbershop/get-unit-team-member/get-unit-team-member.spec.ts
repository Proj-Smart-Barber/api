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
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { GetUnitTeamMemberUseCase } from "./get-unit-team-member";

describe("GetUnitTeamMemberUseCase", () => {
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let usersRepository: InMemoryUsersRepository;
  let sut: GetUnitTeamMemberUseCase;

  beforeEach(() => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    usersRepository = new InMemoryUsersRepository();
    membershipsRepository = new InMemoryMembershipsRepository(usersRepository);
    sut = new GetUnitTeamMemberUseCase(
      membershipsRepository,
      barbershopsRepository,
      usersRepository,
    );
  });

  it("permite ao proprietário ativo consultar o detalhe do membro com sucesso", async () => {
    const ownerId = new UniqueEntityId();
    const barbershopId = new UniqueEntityId();
    const barberId = new UniqueEntityId();

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Central",
        ownerId,
        slug: Slug.create("central"),
        cnpj: "12345678000199",
        location: "Centro",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      barbershopId,
    );
    barbershopsRepository.items.push(barbershop);

    const ownerMembership = Membership.create({
      barbershopId,
      userId: ownerId,
      role: Role.OWNER,
      state: "ACTIVE",
    });
    await membershipsRepository.create(ownerMembership);

    const passwordHash = await Password.generateHashFromPlainText("12345678", 6);
    const barberUser = User.create(
      {
        name: "Carlos Barbeiro",
        email: "carlos@example.com",
        cpf: "11122233344",
        password: passwordHash,
        accountType: "BARBER",
        avatarUrl: "https://avatar.url/carlos.png",
      },
      barberId,
    );
    await usersRepository.save(barberUser);

    const barberMembership = Membership.create({
      barbershopId,
      userId: barberId,
      role: Role.BARBERMAN,
      state: "ACTIVE",
    });
    const createdMembership =
      await membershipsRepository.create(barberMembership);

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: barbershopId.toString(),
      membershipId: createdMembership.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.membershipId).toBe(createdMembership.id.toString());
      expect(result.value.userId).toBe(barberId.toString());
      expect(result.value.name).toBe("Carlos Barbeiro");
      expect(result.value.role).toBe(Role.BARBERMAN);
      expect(result.value.state).toBe("ACTIVE");
      expect(result.value.avatarUrl).toBe("https://avatar.url/carlos.png");
    }
  });

  it("recusa acesso se o ator for proprietário de outra unidade", async () => {
    const ownerAId = new UniqueEntityId();
    const ownerBId = new UniqueEntityId();
    const shopAId = new UniqueEntityId();
    const shopBId = new UniqueEntityId();

    const shopA = Barbershop.create(
      {
        name: "Shop A",
        ownerId: ownerAId,
        slug: Slug.create("shop-a"),
        cnpj: "11111111000111",
        location: "A",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      shopAId,
    );
    barbershopsRepository.items.push(shopA);

    const shopB = Barbershop.create(
      {
        name: "Shop B",
        ownerId: ownerBId,
        slug: Slug.create("shop-b"),
        cnpj: "22222222000122",
        location: "B",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      shopBId,
    );
    barbershopsRepository.items.push(shopB);

    await membershipsRepository.create(
      Membership.create({
        barbershopId: shopAId,
        userId: ownerAId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );
    await membershipsRepository.create(
      Membership.create({
        barbershopId: shopBId,
        userId: ownerBId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    const barberMembership = await membershipsRepository.create(
      Membership.create({
        barbershopId: shopAId,
        userId: new UniqueEntityId(),
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    const result = await sut.execute({
      actorId: ownerBId.toString(),
      shopId: shopAId.toString(),
      membershipId: barberMembership.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
  });
});
