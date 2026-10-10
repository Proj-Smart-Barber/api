import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryServiceItemsRepository } from "../../../../../../test/repositories/in-memory-service-items-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { InMemoryShoppingCartsRepository } from "../../../../../../test/repositories/in-memory-shopping-carts-repository";
import { Service } from "../../../../enterprise/entities/service";
import { ServiceItem } from "../../../../enterprise/entities/service-item";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { CreateShoppingCartUseCase } from "./create-shopping-cart";

let inMemoryShoppingCartsRepository: InMemoryShoppingCartsRepository;
let inMemoryServiceItemsRepository: InMemoryServiceItemsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: CreateShoppingCartUseCase;

describe("Create Shopping Cart Use Case", () => {
  beforeEach(() => {
    inMemoryShoppingCartsRepository = new InMemoryShoppingCartsRepository();
    inMemoryServiceItemsRepository = new InMemoryServiceItemsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new CreateShoppingCartUseCase(
      inMemoryShoppingCartsRepository,
      inMemoryServiceItemsRepository,
      inMemoryServicesRepository,
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

    inMemoryServiceItemsRepository.items.push(
      ServiceItem.create(
        {
          serviceId: new UniqueEntityId("service-1"),
          titleSnapshot: "Corte de Cabelo",
          priceInCentsSnapshot: 5000,
          durationInMinutesSnapshot: 30,
        },
        new UniqueEntityId("service-item-1"),
      ),
    );
  });

  it("should be able to create a shopping cart using the service item price", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      serviceItemId: "service-item-1",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      expect(inMemoryShoppingCartsRepository.items).toHaveLength(1);
      expect(result.value.cart.serviceItemId.toString()).toBe("service-item-1");
      expect(result.value.cart.userId.toString()).toBe("customer-1");
      expect(result.value.cart.totalPriceInCents).toBe(5000);
    }
  });

  it("should fall back to the live service price when the snapshot is missing", async () => {
    const serviceItemWithoutSnapshot = ServiceItem.create(
      {
        serviceId: new UniqueEntityId("service-1"),
      },
      new UniqueEntityId("service-item-2"),
    );
    inMemoryServiceItemsRepository.items.push(serviceItemWithoutSnapshot);

    const result = await sut.execute({
      customerId: "customer-1",
      serviceItemId: "service-item-2",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      expect(result.value.cart.totalPriceInCents).toBe(5000);
    }
  });

  it("should not be able to create a shopping cart for a non-existing service item", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      serviceItemId: "non-existing-service-item",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
