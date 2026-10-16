import { describe, beforeEach, it, expect, vi } from "vitest";
import { CalculateAvailabilityController } from "./calculate-availability.controller";
import { CalculateAvailabilityUseCase } from "../../../../domain/application/use-cases/schedule/calculate-availability/calculate-availability";
import { InMemorySchedulesRepository } from "../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryScheduleExceptionsRepository } from "../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { InMemoryServicesRepository } from "../../../../../test/repositories/in-memory-services-repository";
import { InMemoryBookingsRepository } from "../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { Barbershop } from "../../../../domain/enterprise/entities/barbershop";
import { BarbershopSchedule } from "../../../../domain/enterprise/entities/barbershop-schedule";
import { Service } from "../../../../domain/enterprise/entities/service";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import { Slug } from "../../../../domain/enterprise/entities/value-objects/slug";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryBookingsRepository: InMemoryBookingsRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let calculateAvailabilityUseCase: CalculateAvailabilityUseCase;
let controller: CalculateAvailabilityController;

const shopId = "shop-alpha-1";
const serviceId = "service-alpha-1";

describe("CalculateAvailabilityController", () => {
  beforeEach(async () => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();

    calculateAvailabilityUseCase = new CalculateAvailabilityUseCase(
      inMemorySchedulesRepository,
      inMemoryScheduleExceptionsRepository,
      inMemoryServicesRepository,
      inMemoryBookingsRepository,
      inMemoryBarbershopsRepository,
    );
    controller = new CalculateAvailabilityController(
      calculateAvailabilityUseCase,
    );

    // Barbearia ativa
    inMemoryBarbershopsRepository.items.push(
      Barbershop.create(
        {
          name: "Barbearia Imperial",
          ownerId: new UniqueEntityId("owner-1"),
          slug: Slug.create("barbearia-imperial"),
          cnpj: "12345678000190",
          location: "Rua Imperial, 100",
          timezone: "America/Sao_Paulo",
          status: "ACTIVE",
        },
        new UniqueEntityId(shopId),
      ),
    );

    // Serviço ativo
    inMemoryServicesRepository.items.push(
      Service.create(
        {
          barbershopId: new UniqueEntityId(shopId),
          title: "Corte Tradicional",
          durationInMinutes: 30,
          priceInCents: 4500,
          isActive: true,
        },
        new UniqueEntityId(serviceId),
      ),
    );

    // Jornada geral (2026-09-15 é Terça-feira)
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId(shopId),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "TUESDAY",
        openTime: "09:00",
        closeTime: "12:00",
      }),
    );
  });

  it("should return 200 with calculated availability slots", async () => {
    const response = await controller.handle({
      shopId,
      date: "2026-09-15",
      serviceIds: serviceId,
    });

    expect(response.statusCode).toBe(200);
    const body = response.body as {
      slots: Array<{ start: string; end: string }>;
    };
    expect(body.slots).toBeDefined();
    expect(body.slots.length).toBeGreaterThan(0);
    expect(body.slots[0]).toHaveProperty("start");
    expect(body.slots[0]).toHaveProperty("end");
  });

  it("should return 400 on Zod schema validation error (missing required fields)", async () => {
    const response = await controller.handle({
      shopId,
      // date is missing
      serviceIds: serviceId,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  it("should return 400 on domain business rule error (invalid/non-existent service)", async () => {
    const response = await controller.handle({
      shopId,
      date: "2026-09-15",
      serviceIds: "non-existent-service-id",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toBe(
      "Um ou mais serviços não foram encontrados ou estão inativos para esta barbearia.",
    );
  });

  it("should return 500 on unexpected unhandled error", async () => {
    vi.spyOn(calculateAvailabilityUseCase, "execute").mockRejectedValueOnce(
      new Error("Unexpected calculation failure"),
    );

    const response = await controller.handle({
      shopId,
      date: "2026-09-15",
      serviceIds: serviceId,
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: "Unexpected calculation failure",
    });
  });
});
