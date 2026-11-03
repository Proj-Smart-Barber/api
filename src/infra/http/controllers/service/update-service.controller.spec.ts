import { beforeEach, describe, expect, it } from "vitest";
import { UpdateServiceController } from "./update-service.controller";
import { UpdateServiceUseCase } from "../../../../domain/application/use-cases/service/update-service/update-service";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../test/repositories/in-memory-services-repository";
import { Barbershop } from "../../../../domain/enterprise/entities/barbershop";
import { Service } from "../../../../domain/enterprise/entities/service";
import { Slug } from "../../../../domain/enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";

const ownerId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const serviceId = "33333333-3333-4333-8333-333333333333";
let controller: UpdateServiceController;
let services: InMemoryServicesRepository;

beforeEach(() => {
  const shops = new InMemoryBarbershopsRepository();
  services = new InMemoryServicesRepository();
  shops.items.push(
    Barbershop.create(
      {
        name: "Unidade de teste",
        ownerId: new UniqueEntityId(ownerId),
        timezone: "America/Sao_Paulo",
        slug: Slug.create("unidade-de-teste"),
        cnpj: "12345678901234",
        location: "Endereco de teste",
        status: "ACTIVE",
      },
      new UniqueEntityId(shopId),
    ),
  );
  services.items.push(
    Service.create(
      {
        barbershopId: new UniqueEntityId(shopId),
        title: "Corte",
        priceInCents: 3500,
        durationInMinutes: 30,
        isActive: true,
        isFeatured: false,
      },
      new UniqueEntityId(serviceId),
    ),
  );
  controller = new UpdateServiceController(
    new UpdateServiceUseCase(shops, services),
  );
});

describe("UpdateServiceController presentation fields", () => {
  it("persists featured state and order without changing price or duration", async () => {
    const result = await controller.handle({
      userId: ownerId,
      shopId,
      serviceId,
      isFeatured: true,
      featuredOrder: 2,
    });
    expect(result.statusCode).toBe(200);
    expect(services.items[0].isFeatured).toBe(true);
    expect(services.items[0].featuredOrder).toBe(2);
    expect(services.items[0].priceInCents).toBe(3500);
    expect(services.items[0].durationInMinutes).toBe(30);
    const disabled = await controller.handle({
      userId: ownerId,
      shopId,
      serviceId,
      isFeatured: false,
    });
    expect(disabled.statusCode).toBe(200);
    expect(services.items[0].isFeatured).toBe(false);
  });

  it("does not let another actor change featured state", async () => {
    const result = await controller.handle({
      userId: "44444444-4444-4444-8444-444444444444",
      shopId,
      serviceId,
      isFeatured: true,
    });
    expect(result.statusCode).toBe(403);
    expect(services.items[0].isFeatured).toBe(false);
  });

  it("enforces the gallery restriction instead of silently accepting an image URL", async () => {
    const result = await controller.handle({
      userId: ownerId,
      shopId,
      serviceId,
      imageUrl: "https://example.invalid/arbitrary.webp",
    });
    expect(result.statusCode).toBe(400);
    expect(services.items[0].imageUrl).toBeUndefined();
  });
});
