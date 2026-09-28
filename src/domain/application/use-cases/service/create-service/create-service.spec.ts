import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { CreateServiceUseCase } from "./create-service";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: CreateServiceUseCase;

describe("Create Service Use Case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new CreateServiceUseCase(
      inMemoryBarbershopsRepository,
      inMemoryServicesRepository,
    );

    inMemoryBarbershopsRepository.items.push(
      Barbershop.create(
        {
          name: "Barbearia do Carlos",
          ownerId: new UniqueEntityId("owner-1"),
          timezone: "America/Sao_Paulo",
          slug: Slug.create("barbearia-do-carlos"),
          cnpj: "12345678901234",
          location: "Rua Teste, 123",
          status: "ACTIVE",
        },
        new UniqueEntityId("shop-1"),
      ),
    );
  });

  it("should be able to create a new service as owner", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      userId: "owner-1",
      title: "Corte Degradê",
      description: "Corte moderno com acabamento na navalha",
      priceInCents: 4500,
      durationInMinutes: 40,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.title).toBe("Corte Degradê");
      expect(result.value.service.priceInCents).toBe(4500);
      expect(result.value.service.durationInMinutes).toBe(40);
      expect(result.value.service.isActive).toBe(true);
      expect(result.value.service.barbershopId.toString()).toBe("shop-1");
      expect(inMemoryServicesRepository.items).toHaveLength(1);
    }
  });

  it("should not allow non-owner to create a service", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      userId: "other-user",
      title: "Corte Degradê",
      priceInCents: 4500,
      durationInMinutes: 40,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
    expect(inMemoryServicesRepository.items).toHaveLength(0);
  });

  it("should not create service for non-existent barbershop", async () => {
    const result = await sut.execute({
      barbershopId: "non-existent-shop",
      userId: "owner-1",
      title: "Corte Degradê",
      priceInCents: 4500,
      durationInMinutes: 40,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should validate invalid title, price, and duration", async () => {
    const invalidTitle = await sut.execute({
      barbershopId: "shop-1",
      userId: "owner-1",
      title: " ",
      priceInCents: 4500,
      durationInMinutes: 40,
    });
    expect(invalidTitle.isLeft()).toBe(true);

    const invalidPrice = await sut.execute({
      barbershopId: "shop-1",
      userId: "owner-1",
      title: "Corte",
      priceInCents: 0,
      durationInMinutes: 40,
    });
    expect(invalidPrice.isLeft()).toBe(true);

    const invalidDuration = await sut.execute({
      barbershopId: "shop-1",
      userId: "owner-1",
      title: "Corte",
      priceInCents: 4500,
      durationInMinutes: -10,
    });
    expect(invalidDuration.isLeft()).toBe(true);
  });
});
