import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { GetBarbershopUseCase } from "./get-barbershop";
import { Barbershop } from "@/domain/enterprise/entities/barbershop";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { Slug } from "@/domain/enterprise/entities/value-objects/slug";
import { ResourceNotFoundError } from "@/domain/application/use-cases/_errors/resource-not-found-error";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: GetBarbershopUseCase;

describe("Get Barbershop", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    sut = new GetBarbershopUseCase(inMemoryBarbershopsRepository);
  });

  it("should be able to get a barbershop by id", async () => {
    const newBarbershop = Barbershop.create(
      {
        name: "Barbearia do Zé",
        ownerId: new UniqueEntityId("owner-1"),
        slug: Slug.create("barbearia-do-ze"),
        cnpj: "12345678901234",
        location: "Rua X",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-1"),
    );

    inMemoryBarbershopsRepository.items.push(newBarbershop);

    const result = await sut.execute({
      barbershopId: "shop-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.barbershop.name).toBe("Barbearia do Zé");
      expect(result.value.barbershop.timezone).toBe("America/Sao_Paulo");
    }
  });

  it("should return error when barbershop does not exist", async () => {
    const result = await sut.execute({
      barbershopId: "shop-invalid",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
