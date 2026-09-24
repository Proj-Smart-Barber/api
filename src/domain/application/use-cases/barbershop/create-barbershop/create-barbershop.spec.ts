import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryStaffsRepository } from "../../../../../../test/repositories/in-memory-staffs-repository";
import { Staff } from "../../../../enterprise/entities/staff";
import { Role } from "../../../../enterprise/entities/membership";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { BarbershopAlreadyExistsError } from "../../_errors/barbershop-already-exists-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { CreateBarbershopUseCase } from "./create-barbershop";

let barbershopsRepository: InMemoryBarbershopsRepository;
let staffsRepository: InMemoryStaffsRepository;
let sut: CreateBarbershopUseCase;
let owner: Staff;

async function createOwner() {
  const newOwner = Staff.create({
    name: "Owner",
    email: "owner@example.com",
    password: Password.create("hashed-password"),
    cpf: "12345678901",
  });

  return staffsRepository.save(newOwner);
}

describe("Create barbershop", () => {
  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    staffsRepository = new InMemoryStaffsRepository();
    sut = new CreateBarbershopUseCase(barbershopsRepository, staffsRepository);
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
      expect(membership.staffId.toString()).toBe(owner.id.toString());
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
});
