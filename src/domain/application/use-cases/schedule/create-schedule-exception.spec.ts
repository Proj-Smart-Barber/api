import { InMemoryScheduleExceptionsRepository } from "../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { CreateScheduleExceptionUseCase } from "./create-schedule-exception";

let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let sut: CreateScheduleExceptionUseCase; // sut = system under test

describe("Create Schedule Exception", () => {
  // O beforeEach zera o banco em memória e recria o caso de uso antes de CADA teste
  beforeEach(() => {
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    sut = new CreateScheduleExceptionUseCase(
      inMemoryScheduleExceptionsRepository,
    );
  });

  it("should be able to create a schedule exception for the whole day", async () => {
    // 1. Execução: Passamos os dados para fechar a barbearia num feriado (sem horários)
    const result = await sut.execute({
      barbershopId: "barbershop-1",
      date: "2026-10-15",
      startTime: null,
      endTime: null,
      reason: "Feriado Municipal",
    });

    // 2. Asserção (Verificação): O Either deve retornar "right" (Sucesso)
    expect(result.isRight()).toBe(true);

    // Verificamos se foi salvo corretamente no repositório em memória
    if (result.isRight()) {
      expect(result.value.exception.barbershopId.toString()).toEqual(
        "barbershop-1",
      );
      expect(result.value.exception.reason).toEqual("Feriado Municipal");
      expect(inMemoryScheduleExceptionsRepository.items).toHaveLength(1);
    }
  });

  it("should be able to create a schedule exception for a specific barberman in a specific time slot", async () => {
    // 1. Execução: Exceção só pra um barbeiro, no horário do almoço
    const result = await sut.execute({
      barbershopId: "barbershop-1",
      barbermanId: "barberman-1",
      date: "2026-10-16",
      startTime: "12:00",
      endTime: "14:00",
      reason: "Médico",
    });

    // 2. Asserção
    expect(result.isRight()).toBe(true);
    expect(inMemoryScheduleExceptionsRepository.items).toHaveLength(1);
    expect(
      inMemoryScheduleExceptionsRepository.items[0].barbermanId?.toString(),
    ).toEqual("barberman-1");
    expect(inMemoryScheduleExceptionsRepository.items[0].startTime).toEqual(
      "12:00",
    );
  });
});
