import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryServiceItemsRepository } from "../../../../../../test/repositories/in-memory-service-items-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { Service } from "../../../../enterprise/entities/service";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { CreateServiceItemUseCase } from "./create-service-item";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryServiceItemsRepository: InMemoryServiceItemsRepository;
let sut: CreateServiceItemUseCase;

describe("Create Service Item Use Case", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryServiceItemsRepository = new InMemoryServiceItemsRepository();
    sut = new CreateServiceItemUseCase(
      inMemoryServicesRepository,
      inMemoryServiceItemsRepository,
    );

    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId("barbershop-1"),
          title: "Corte de Cabelo",
          priceInCents: 5000,
          durationInMinutes: 30,
        },
        new UniqueEntityId("service-1"),
      ),
    );
  });

  it("should be able to create a service item with snapshots from the service", async () => {
    const result = await sut.execute({ serviceId: "service-1" });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      expect(inMemoryServiceItemsRepository.items).toHaveLength(1);
      expect(result.value.serviceItem.serviceId.toString()).toBe("service-1");
      expect(result.value.serviceItem.titleSnapshot).toBe("Corte de Cabelo");
      expect(result.value.serviceItem.priceInCentsSnapshot).toBe(5000);
      expect(result.value.serviceItem.durationInMinutesSnapshot).toBe(30);
    }
  });

  it("should not be able to create a service item for a non-existing service", async () => {
    const result = await sut.execute({ serviceId: "non-existing-service" });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a service item for an inactive service", async () => {
    inMemoryServicesRepository.items[0].deactivate();

    const result = await sut.execute({ serviceId: "service-1" });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
