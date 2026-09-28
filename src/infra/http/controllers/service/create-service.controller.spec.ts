import { describe, beforeEach, it, expect } from "vitest";
import { CreateServiceUseCase } from "../../../../domain/application/use-cases/service/create-service/create-service";
import { CreateServiceController } from "./create-service.controller";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryServicesRepository } from "../../../../../test/repositories/in-memory-services-repository";
import { Barbershop } from "../../../../domain/enterprise/entities/barbershop";
import { Slug } from "../../../../domain/enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";

let barbershopsRepository: InMemoryBarbershopsRepository;
let servicesRepository: InMemoryServicesRepository;
let controller: CreateServiceController;

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
let barbershopId: string;

describe("CreateServiceController", () => {
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

    const useCase = new CreateServiceUseCase(
      barbershopsRepository,
      servicesRepository,
    );
    controller = new CreateServiceController(useCase);
  });

  it("should create a service successfully by the owner", async () => {
    const response = await controller.handle({
      userId: ownerId,
      shopId: barbershopId,
      title: "Corte Masculino",
      priceInCents: 4500,
      durationInMinutes: 30,
      description: "Corte moderno tesoura/máquina",
    });

    expect(response.statusCode).toBe(201);
    expect((response.body as any).service).toMatchObject({
      title: "Corte Masculino",
      priceInCents: 4500,
      durationInMinutes: 30,
      isActive: true,
    });
    expect(servicesRepository.items).toHaveLength(1);
  });

  it("should reject creation if caller is not the owner", async () => {
    const response = await controller.handle({
      userId: otherUserId,
      shopId: barbershopId,
      title: "Corte Masculino",
      priceInCents: 4500,
      durationInMinutes: 30,
    });

    expect(response.statusCode).toBe(403);
    expect(servicesRepository.items).toHaveLength(0);
  });

  it("should reject creation with invalid non-positive price", async () => {
    const response = await controller.handle({
      userId: ownerId,
      shopId: barbershopId,
      title: "Corte Inválido",
      priceInCents: 0,
      durationInMinutes: 30,
    });

    expect(response.statusCode).toBe(400);
    expect(servicesRepository.items).toHaveLength(0);
  });
});
