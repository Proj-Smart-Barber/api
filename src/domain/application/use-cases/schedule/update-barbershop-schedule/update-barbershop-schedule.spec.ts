import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { UpdateBarbershopScheduleUseCase } from "./update-barbershop-schedule";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: UpdateBarbershopScheduleUseCase;

describe("Update Barbershop Schedule", () => {
  beforeEach(async () => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    sut = new UpdateBarbershopScheduleUseCase(
      inMemorySchedulesRepository,
      inMemoryBarbershopsRepository,
    );

    const barbershop = Barbershop.create(
      {
        name: "Test Shop",
        slug: Slug.create("test-shop"),
        timezone: "America/Sao_Paulo",
        ownerId: new UniqueEntityId("staff-1"),
        status: "ACTIVE",
        cnpj: "12.345.678/0001-90",
        location: "Rua de Teste, 123",
      },
      new UniqueEntityId("shop-1"),
    );

    inMemoryBarbershopsRepository.items.push(barbershop);
  });

  it("should be able to create/update a schedule day", async () => {
    // 1. Executando a criação normal
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    expect(inMemorySchedulesRepository.items).toHaveLength(1);
    expect(inMemorySchedulesRepository.items[0].dayOfWeek).toBe("MONDAY");
    expect(inMemorySchedulesRepository.items[0].openTime).toBe("08:00");
    expect(inMemorySchedulesRepository.items[0].closeTime).toBe("18:00");
  });

  it("should not be able to create a schedule if openTime is greater or equal to closeTime", async () => {
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "18:00",
          closeTime: "08:00",
        },
      ],
    });

    // 2. Verificando a falha
    expect(result.isLeft()).toBe(true); // Left significa Erro/Falha no Either
    expect(inMemorySchedulesRepository.items).toHaveLength(0); // Nada foi salvo
  });
});
