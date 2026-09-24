import { CreateBarbershopUseCase } from "../../../../domain/application/use-cases/barbershop/create-barbershop/create-barbershop";
import { Role } from "../../../../domain/enterprise/entities/membership";
import { Staff } from "../../../../domain/enterprise/entities/staff";
import { Password } from "../../../../domain/enterprise/entities/value-objects/password";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryStaffsRepository } from "../../../../../test/repositories/in-memory-staffs-repository";
import { CreateBarbershopController } from "./create-barbershop.controller";

let barbershopsRepository: InMemoryBarbershopsRepository;
let controller: CreateBarbershopController;
let owner: Staff;

describe("CreateBarbershopController", () => {
  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    const staffsRepository = new InMemoryStaffsRepository();
    owner = await staffsRepository.save(
      Staff.create({
        name: "Owner",
        email: "owner@example.com",
        password: Password.create("hashed-password"),
        cpf: "12345678901",
      }),
    );

    const useCase = new CreateBarbershopUseCase(
      barbershopsRepository,
      staffsRepository,
    );
    controller = new CreateBarbershopController(useCase);
  });

  it("should create a barbershop for the authenticated staff", async () => {
    const response = await controller.handle({
      userId: owner.id.toString(),
      name: "Barbearia do Zé",
      cnpj: "12.345.678/0001-90",
      location: "Rua X, 123",
    });

    expect(response.statusCode).toBe(201);
    expect(barbershopsRepository.items).toHaveLength(1);
    expect(barbershopsRepository.memberships[0].role).toBe(Role.OWNER);
    expect(barbershopsRepository.memberships[0].staffId.toString()).toBe(
      owner.id.toString(),
    );
  });

  it("should reject an invalid CNPJ", async () => {
    const response = await controller.handle({
      userId: owner.id.toString(),
      name: "Barbearia do Zé",
      cnpj: "123",
      location: "Rua X, 123",
    });

    expect(response.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);
  });

  it("should reject a client-provided owner", async () => {
    const request = {
      userId: owner.id.toString(),
      name: "Barbearia do Zé",
      cnpj: "12345678000190",
      location: "Rua X, 123",
      ownerId: "00000000-0000-0000-0000-000000000000",
    };

    const response = await controller.handle(request);

    expect(response.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);
  });
});
