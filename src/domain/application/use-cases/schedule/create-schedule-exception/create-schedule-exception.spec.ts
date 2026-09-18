import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { CreateScheduleExceptionUseCase } from "./create-schedule-exception";
import { Barbershop } from "@/domain/enterprise/entities/barbershop";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

import { Slug } from "@/domain/enterprise/entities/value-objects/slug";

let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: CreateScheduleExceptionUseCase; // sut = system under test

describe("Create Schedule Exception", () => {
  // O beforeEach zera o banco em memória e recria o caso de uso antes de CADA teste
  beforeEach(() => {
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    sut = new CreateScheduleExceptionUseCase(
      inMemoryScheduleExceptionsRepository,
      inMemoryBarbershopsRepository,
    );

    inMemoryBarbershopsRepository.items.push(
      Barbershop.create(
        {
          name: "Test Barbershop",
          ownerId: new UniqueEntityId("owner-1"),
          timezone: "UTC",
          slug: Slug.create("test-barbershop"),
          cnpj: "12345678901234",
          location: "Location",
          status: "ACTIVE",
        },
        new UniqueEntityId("shop-1"),
      ),
    );
  });

  it("should be able to create a schedule exception for the whole day", async () => {
    // 1. Execução: Passamos os dados para fechar a barbearia num feriado (sem horários)
    const result = await sut.execute({
      barbershopId: "shop-1",
      staffId: "owner-1",
      date: "2026-10-15",
      startTime: null,
      endTime: null,
      reason: "Holiday",
    });

    // 2. Asserção (Verificação): O Either deve retornar "right" (Sucesso)
    expect(result.isRight()).toBe(true);

    // Verificamos se foi salvo corretamente no repositório em memória
    if (result.isRight()) {
      expect(result.value.exception.barbershopId.toString()).toEqual("shop-1");
      expect(result.value.exception.reason).toEqual("Holiday");
      expect(inMemoryScheduleExceptionsRepository.items).toHaveLength(1);
    }
  });

  it("should be able to create a schedule exception for a specific barberman in a specific time slot", async () => {
    // 1. Execução: Exceção só pra um barbeiro, no horário do almoço
    const result = await sut.execute({
      barbershopId: "shop-1",
      staffId: "owner-1",
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
