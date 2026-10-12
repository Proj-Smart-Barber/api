import { describe, it, expect, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { User } from "../../../../enterprise/entities/user";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { ListBarbershopProfessionalsUseCase } from "./list-barbershop-professionals";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

describe("ListBarbershopProfessionalsUseCase", () => {
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let usersRepository: InMemoryUsersRepository;
  let sut: ListBarbershopProfessionalsUseCase;

  beforeEach(() => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    usersRepository = new InMemoryUsersRepository();
    sut = new ListBarbershopProfessionalsUseCase(
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
    );
  });

  it("should list eligible professionals without exposing PII (CPF, email, password)", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Central",
        ownerId: new UniqueEntityId("owner-1"),
        slug: Slug.create("barbearia-central"),
        cnpj: "11222333000144",
        location: "Rua A, São Paulo - SP",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-1"),
    );
    barbershopsRepository.items.push(shop);

    const barberUser = User.create(
      {
        name: "Carlos Barbeiro",
        email: "carlos@example.com",
        cpf: "11111111111",
        password: await Password.generateHashFromPlainText(
          "valid-password-15-chars",
          12,
        ),
      },
      new UniqueEntityId("user-barber-1"),
    );
    await usersRepository.save(barberUser);

    const member = Membership.create({
      barbershopId: new UniqueEntityId("shop-1"),
      userId: new UniqueEntityId("user-barber-1"),
      role: Role.BARBERMAN,
    });
    await membershipsRepository.create(member);

    const result = await sut.execute({ shopId: "shop-1" });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.professionals).toHaveLength(1);
      const prof = result.value.professionals[0];
      expect(prof.id).toBe("user-barber-1");
      expect(prof.name).toBe("Carlos Barbeiro");
      expect(prof.role).toBe("BARBERMAN");
      // PII não deve existir
      expect((prof as any).cpf).toBeUndefined();
      expect((prof as any).email).toBeUndefined();
      expect((prof as any).password).toBeUndefined();
    }
  });

  it("should return ResourceNotFoundError when barbershop does not exist", async () => {
    const result = await sut.execute({ shopId: "non-existent-shop" });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
