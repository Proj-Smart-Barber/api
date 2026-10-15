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

  it("should isolate schedules between general, barber A, and barber B without cross-contamination", async () => {
    // 1. Criar jornada geral da barbearia
    const generalResult = await sut.execute({
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
    expect(generalResult.isRight()).toBe(true);

    // 2. Criar jornada individual para Barbeiro A
    const barberAResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: "barber-a",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "10:00",
          closeTime: "16:00",
        },
      ],
    });
    expect(barberAResult.isRight()).toBe(true);

    // 3. Criar jornada individual para Barbeiro B
    const barberBResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: "barber-b",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "12:00",
          closeTime: "20:00",
        },
      ],
    });
    expect(barberBResult.isRight()).toBe(true);

    // 4. Atualizar Barbeiro A para um novo horário
    const updateBarberAResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: "barber-a",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "15:00",
        },
      ],
    });
    expect(updateBarberAResult.isRight()).toBe(true);

    // 5. Garantir que a jornada geral continua intacta (08:00 - 18:00)
    const generalItems = inMemorySchedulesRepository.items.filter(
      (item) => item.barbermanId === null,
    );
    expect(generalItems).toHaveLength(1);
    expect(generalItems[0].openTime).toBe("08:00");
    expect(generalItems[0].closeTime).toBe("18:00");

    // 6. Garantir que a jornada do Barbeiro B continua intacta (12:00 - 20:00)
    const barberBItems = inMemorySchedulesRepository.items.filter(
      (item) => item.barbermanId?.toString() === "barber-b",
    );
    expect(barberBItems).toHaveLength(1);
    expect(barberBItems[0].openTime).toBe("12:00");
    expect(barberBItems[0].closeTime).toBe("20:00");

    // 7. Garantir que a jornada do Barbeiro A foi devidamente atualizada (09:00 - 15:00)
    const barberAItems = inMemorySchedulesRepository.items.filter(
      (item) => item.barbermanId?.toString() === "barber-a",
    );
    expect(barberAItems).toHaveLength(1);
    expect(barberAItems[0].openTime).toBe("09:00");
    expect(barberAItems[0].closeTime).toBe("15:00");
  });
});
