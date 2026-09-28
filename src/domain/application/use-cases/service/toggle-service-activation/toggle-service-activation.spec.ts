import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { ToggleServiceActivationUseCase } from "./toggle-service-activation";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Service } from "../../../../enterprise/entities/service";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ToggleServiceActivationUseCase;

describe("Toggle Service Activation Use Case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new ToggleServiceActivationUseCase(
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
        new UniqueEntityId("service-1"),
      ),
    );
  });

  it("should be able to deactivate a service as owner", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "owner-1",
      isActive: false,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.isActive).toBe(false);
    }
  });

  it("should be able to re-activate a service as owner", async () => {
    // First deactivate
    await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "owner-1",
      isActive: false,
    });

    // Then re-activate
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "owner-1",
      isActive: true,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.isActive).toBe(true);
    }
  });

  it("should not allow non-owner to toggle service activation", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      serviceId: "service-1",
      userId: "non-owner",
      isActive: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
