import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { UpdateBarbershopScheduleUseCase } from "./update-barbershop-schedule";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let sut: UpdateBarbershopScheduleUseCase;

describe("Update Barbershop Schedule", () => {
  beforeEach(() => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    sut = new UpdateBarbershopScheduleUseCase(inMemorySchedulesRepository);
  });

  it("should be able to create/update a schedule day", async () => {
    // 1. Executando a criação normal
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      dayOfWeek: "MONDAY",
      openTime: "09:00",
      closeTime: "18:00",
    });

    // 2. Verificando o sucesso
    expect(result.isRight()).toBe(true);
    expect(inMemorySchedulesRepository.items).toHaveLength(1);
    expect(inMemorySchedulesRepository.items[0].dayOfWeek).toEqual("MONDAY");
  });

  it("should not be able to create a schedule if openTime is greater or equal to closeTime", async () => {
    // 1. Tentando abrir a barbearia às 18h e fechar às 09h
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      dayOfWeek: "MONDAY",
      openTime: "18:00",
      closeTime: "09:00",
    });

    // 2. Verificando a falha
    expect(result.isLeft()).toBe(true); // Left significa Erro/Falha no Either
    expect(inMemorySchedulesRepository.items).toHaveLength(0); // Nada foi salvo
  });
});
