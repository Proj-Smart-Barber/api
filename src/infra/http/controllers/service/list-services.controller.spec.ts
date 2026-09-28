import { describe, beforeEach, it, expect } from "vitest";
import { ListServicesUseCase } from "../../../../domain/application/use-cases/service/list-services/list-services";
import { ListServicesController } from "./list-services.controller";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../test/repositories/in-memory-services-repository";
import { Barbershop } from "../../../../domain/enterprise/entities/barbershop";
import { Slug } from "../../../../domain/enterprise/entities/value-objects/slug";
import { Service } from "../../../../domain/enterprise/entities/service";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";

let barbershopsRepository: InMemoryBarbershopsRepository;
let servicesRepository: InMemoryServicesRepository;
let controller: ListServicesController;

const ownerId = "11111111-1111-4111-8111-111111111111";
let barbershopId: string;

describe("ListServicesController", () => {
  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    servicesRepository = new InMemoryServicesRepository();

    const barbershop = Barbershop.create({
      name: "Barbearia Imperial",
      ownerId: new UniqueEntityId(ownerId),
      slug: Slug.createFromText("barbearia-imperial"),
      cnpj: "12345678000190",
      location: "Rua Central, 100",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });
    barbershopsRepository.items.push(barbershop);
    barbershopId = barbershop.id.toString();

    // Criar um serviço ativo e um inativo
    const activeService = Service.create({
      barbershopId: barbershop.id,
      title: "Corte Cabelo",
      priceInCents: 4000,
      durationInMinutes: 30,
      isActive: true,
    });
    const inactiveService = Service.create({
      barbershopId: barbershop.id,
      title: "Barba Terapia",
      priceInCents: 3500,
      durationInMinutes: 25,
      isActive: false,
    });
    await servicesRepository.create(activeService);
    await servicesRepository.create(inactiveService);

    const useCase = new ListServicesUseCase(
      barbershopsRepository,
      servicesRepository,
    );
    controller = new ListServicesController(useCase);
  });

  it("should list only active services for anonymous/public requests", async () => {
    const response = await controller.handle({
      shopId: barbershopId,
      page: 1,
      limit: 20,
      includeInactive: false,
    });

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Corte Cabelo");
    expect(body.total).toBe(1);
  });

  it("should list both active and inactive services when requested by owner", async () => {
    const response = await controller.handle({
      shopId: barbershopId,
      userId: ownerId,
      page: 1,
      limit: 20,
      includeInactive: true,
    });

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("should reject includeInactive when caller is not the owner", async () => {
    const response = await controller.handle({
      shopId: barbershopId,
      userId: "33333333-3333-4333-8333-333333333333",
      page: 1,
      limit: 20,
      includeInactive: true,
    });

    expect(response.statusCode).toBe(403);
  });
});
