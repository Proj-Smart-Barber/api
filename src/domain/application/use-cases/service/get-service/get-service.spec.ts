import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { GetServiceUseCase } from "./get-service";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Service } from "../../../../enterprise/entities/service";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: GetServiceUseCase;

describe("Get Service Use Case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new GetServiceUseCase(
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

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Simples",
          priceInCents: 3500,
          durationInMinutes: 30,
          isActive: true,
        },
        new UniqueEntityId("service-active"),
      ),
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Inativo",
          priceInCents: 3500,
          durationInMinutes: 30,
          isActive: false,
        },
        new UniqueEntityId("service-inactive"),
      ),
    );
  });

  it("should be able to get an active service anonymously", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-active",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.title).toBe("Corte Simples");
    }
  });

  it("should return not found for inactive service when accessed anonymously", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-inactive",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should allow owner to read inactive service", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-inactive",
      userId: "owner-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.title).toBe("Corte Inativo");
    }
  });

  it("should return not found for service belonging to another barbershop", async () => {
    const result = await sut.execute({
      barbershopId: "other-shop",
      serviceId: "service-active",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
