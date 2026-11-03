import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { User } from "../../../../enterprise/entities/user";
import { Role } from "../../../../enterprise/entities/membership";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { BarbershopAlreadyExistsError } from "../../_errors/barbershop-already-exists-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { CreateBarbershopUseCase } from "./create-barbershop";

let barbershopsRepository: InMemoryBarbershopsRepository;
let usersRepository: InMemoryUsersRepository;
let sut: CreateBarbershopUseCase;
let owner: User;

async function createOwner() {
  const newOwner = User.create({
    name: "Owner",
    email: "owner@example.com",
    password: Password.create("hashed-password"),
    cpf: "12345678901",
  });

  return usersRepository.save(newOwner);
}

describe("Create barbershop", () => {
  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    usersRepository = new InMemoryUsersRepository();
    sut = new CreateBarbershopUseCase(barbershopsRepository, usersRepository);
    owner = await createOwner();
  });

  it("should create a barbershop and its owner membership", async () => {
    const result = await sut.execute({
      name: "Barbearia do Zé",
      ownerId: owner.id.toString(),
      cnpj: "12.345.678/0001-90",
      location: "Rua X, 123",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      const barbershop = barbershopsRepository.items[0];
      const membership = barbershopsRepository.memberships[0];

      expect(result.value.barbershopId).toBe(barbershop.id.toString());
      expect(barbershop.ownerId.toString()).toBe(owner.id.toString());
      expect(barbershop.slug.value).toBe("barbearia-do-ze");
      expect(barbershop.cnpj).toBe("12345678000190");
      expect(barbershop.status).toBe("ACTIVE");
      expect(barbershop.timezone).toBe("America/Sao_Paulo");
      expect(membership.barbershopId.toString()).toBe(barbershop.id.toString());
      expect(membership.userId.toString()).toBe(owner.id.toString());
      expect(membership.role).toBe(Role.OWNER);
    }
  });

  it("should allow one owner to create multiple barbershops", async () => {
    const firstResult = await sut.execute({
      name: "Barbearia do Zé",
      ownerId: owner.id.toString(),
      cnpj: "12345678000190",
      location: "Rua X, 123",
    });

    const secondResult = await sut.execute({
      name: "Barbearia do João",
      ownerId: owner.id.toString(),
      cnpj: "98765432000199",
      location: "Rua Y, 456",
    });

    expect(firstResult.isRight()).toBe(true);
    expect(secondResult.isRight()).toBe(true);
    expect(barbershopsRepository.items).toHaveLength(2);
    expect(barbershopsRepository.memberships).toHaveLength(2);
  });

  it("should not create a barbershop with a duplicated CNPJ", async () => {
    await sut.execute({
      name: "Barbearia do Zé",
      ownerId: owner.id.toString(),
      cnpj: "12345678000190",
      location: "Rua X, 123",
    });

    const result = await sut.execute({
      name: "Outra barbearia",
      ownerId: owner.id.toString(),
      cnpj: "12.345.678/0001-90",
      location: "Rua Y, 456",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BarbershopAlreadyExistsError);
    expect(barbershopsRepository.items).toHaveLength(1);
    expect(barbershopsRepository.memberships).toHaveLength(1);
  });

  it("should not create barbershops with the same generated slug", async () => {
    await sut.execute({
      name: "Barbearia do Zé",
      ownerId: owner.id.toString(),
      cnpj: "12345678000190",
      location: "Rua X, 123",
    });

    const result = await sut.execute({
      name: "barbearia  do  Zé!",
      ownerId: owner.id.toString(),
      cnpj: "98765432000199",
      location: "Rua Y, 456",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BarbershopAlreadyExistsError);
  });

  it("should not create a barbershop when the owner does not exist", async () => {
    const result = await sut.execute({
      name: "Barbearia do Zé",
      ownerId: "00000000-0000-0000-0000-000000000000",
      cnpj: "12345678000190",
      location: "Rua X, 123",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(barbershopsRepository.items).toHaveLength(0);
    expect(barbershopsRepository.memberships).toHaveLength(0);
  });

  describe("Commercial Timezone resolution from canonical location", () => {
    it("should resolve America/Rio_Branco for Acre address", async () => {
      const result = await sut.execute({
        name: "Barbearia Acreana",
        ownerId: owner.id.toString(),
        cnpj: "11111111000101",
        location: "Av. Ceará, 100, Centro, Rio Branco - AC, CEP 69900-000",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "11111111000101",
      );
      expect(barbershop?.timezone).toBe("America/Rio_Branco");
    });

    it("should resolve America/Rio_Branco for western Amazonas (Tabatinga)", async () => {
      const result = await sut.execute({
        name: "Barbearia Tabatinga",
        ownerId: owner.id.toString(),
        cnpj: "22222222000102",
        location:
          "Rua Marechal Mallet, 50, Centro, Tabatinga - AM, CEP 69640-000",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "22222222000102",
      );
      expect(barbershop?.timezone).toBe("America/Rio_Branco");
    });

    it("should resolve America/Manaus for central Amazonas (Manaus)", async () => {
      const result = await sut.execute({
        name: "Barbearia Manauara",
        ownerId: owner.id.toString(),
        cnpj: "33333333000103",
        location:
          "Av. Eduardo Ribeiro, 500, Centro, Manaus - AM, CEP 69010-001",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "33333333000103",
      );
      expect(barbershop?.timezone).toBe("America/Manaus");
    });

    it("should resolve America/Noronha for Fernando de Noronha (PE)", async () => {
      const result = await sut.execute({
        name: "Barbearia Ilha",
        ownerId: owner.id.toString(),
        cnpj: "44444444000104",
        location: "Vila dos Remédios, Fernando de Noronha - PE, CEP 53990-000",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "44444444000104",
      );
      expect(barbershop?.timezone).toBe("America/Noronha");
    });

    it("should resolve America/Cuiaba for Mato Grosso", async () => {
      const result = await sut.execute({
        name: "Barbearia Pantaneira",
        ownerId: owner.id.toString(),
        cnpj: "55555555000105",
        location:
          "Av. Historiador Rubens de Mendonça, 1200, Bosque da Saúde, Cuiabá - MT, CEP 78050-000",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "55555555000105",
      );
      expect(barbershop?.timezone).toBe("America/Cuiaba");
    });

    it("should resolve America/Campo_Grande for Mato Grosso do Sul", async () => {
      const result = await sut.execute({
        name: "Barbearia Morena",
        ownerId: owner.id.toString(),
        cnpj: "66666666000106",
        location:
          "Av. Afonso Pena, 1500, Centro, Campo Grande - MS, CEP 79002-072",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "66666666000106",
      );
      expect(barbershop?.timezone).toBe("America/Campo_Grande");
    });

    it("should preserve explicitly passed valid custom timezone", async () => {
      const result = await sut.execute({
        name: "Barbearia Especial",
        ownerId: owner.id.toString(),
        cnpj: "77777777000107",
        location: "Rua X, 123, São Paulo - SP",
        timezone: "America/Cuiaba",
      });

      expect(result.isRight()).toBe(true);
      const barbershop = barbershopsRepository.items.find(
        (b) => b.cnpj === "77777777000107",
      );
      expect(barbershop?.timezone).toBe("America/Cuiaba");
    });
  });
});
