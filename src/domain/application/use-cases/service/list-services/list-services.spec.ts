import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { ListServicesUseCase } from "./list-services";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Service } from "../../../../enterprise/entities/service";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ListServicesUseCase;

describe("List Services Use Case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new ListServicesUseCase(
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
          name: "Barbearia Inativa",
          ownerId: new UniqueEntityId("owner-inactive"),
          timezone: "America/Sao_Paulo",
          slug: Slug.create("barbearia-inativa"),
          cnpj: "11111111000199",
          location: "Rua Fechada, 00",
          status: "INACTIVE",
        },
        new UniqueEntityId("shop-inactive"),
      ),
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Corte Cabelo",
          priceInCents: 4000,
          durationInMinutes: 30,
          isActive: true,
        },
        new UniqueEntityId("service-1"),
      ),
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Barba",
          priceInCents: 3000,
          durationInMinutes: 20,
          isActive: true,
        },
        new UniqueEntityId("service-2"),
      ),
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          title: "Sobrancelha (Inativo)",
          priceInCents: 1500,
          durationInMinutes: 10,
          isActive: false,
        },
        new UniqueEntityId("service-3"),
      ),
      Service.create(
        {
          barbershopId: new UniqueEntityId("shop-2"),
          title: "Serviço de Outra Loja",
          priceInCents: 5000,
          durationInMinutes: 30,
          isActive: true,
        },
        new UniqueEntityId("service-other"),
      ),
    );
  });

  it("should list only active services for public anonymous user", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      includeInactive: false,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.items).toHaveLength(2);
      expect(result.value.total).toBe(2);
      expect(result.value.items.map((s) => s.title)).toEqual([
        "Barba",
        "Corte Cabelo",
      ]); // sorted alphabetically
    }
  });

  it("should list all services including inactive when owner requests includeInactive", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      userId: "owner-1",
      includeInactive: true,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.items).toHaveLength(3);
      expect(result.value.total).toBe(3);
    }
  });

  it("should not allow non-owner to request includeInactive", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      userId: "non-owner",
      includeInactive: true,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should return not found for inactive barbershop on public query", async () => {
    const result = await sut.execute({
      barbershopId: "shop-inactive",
      includeInactive: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
