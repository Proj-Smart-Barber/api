import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { UpdateServiceUseCase } from "./update-service";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Service } from "../../../../enterprise/entities/service";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: UpdateServiceUseCase;

describe("Update Service Use Case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new UpdateServiceUseCase(
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
      Barbershop.create(
        {
          name: "Outra Barbearia",
          ownerId: new UniqueEntityId("owner-2"),
          timezone: "America/Sao_Paulo",
          slug: Slug.create("outra-barbearia"),
          cnpj: "98765432109876",
          location: "Rua Outra, 456",
          status: "ACTIVE",
        },
        new UniqueEntityId("shop-2"),
      ),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Simples",
          description: "Corte básico",
          priceInCents: 3500,
          durationInMinutes: 30,
          isActive: true,
        },
        new UniqueEntityId("service-1"),
      ),
    );
  });

  it("should be able to update a service as owner", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "owner-1",
      title: "Corte Premium",
      priceInCents: 5000,
      durationInMinutes: 45,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.title).toBe("Corte Premium");
      expect(result.value.service.priceInCents).toBe(5000);
      expect(result.value.service.durationInMinutes).toBe(45);
      expect(result.value.service.description).toBe("Corte básico"); // preserved
    }
  });

  it("should not allow non-owner to update a service", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "not-owner",
      title: "Corte Hacker",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should not allow owner of another barbershop to update service", async () => {
    const result = await sut.execute({
      barbershopId: "shop-2",
      serviceId: "service-1", // belongs to shop-1
      userId: "owner-2",
      title: "Tentativa Cross-tenant",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should validate updated values", async () => {
    const invalidPrice = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "owner-1",
      priceInCents: -500,
    });
    expect(invalidPrice.isLeft()).toBe(true);

    const invalidDuration = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "owner-1",
      durationInMinutes: 0,
    });
    expect(invalidDuration.isLeft()).toBe(true);
  });
});
