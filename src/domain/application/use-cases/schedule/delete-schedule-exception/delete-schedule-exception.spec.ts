import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { DeleteScheduleExceptionUseCase } from "./delete-schedule-exception";
import { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let sut: DeleteScheduleExceptionUseCase;

describe("Delete Schedule Exception", () => {
  beforeEach(() => {
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    sut = new DeleteScheduleExceptionUseCase(
      inMemoryScheduleExceptionsRepository,
    );
  });

  it("should be able to delete a schedule exception", async () => {
    // 1. Setup: Criamos uma exceção "na marra" direto no repositório em memória
    const exception = ScheduleException.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        date: new Date("2026-10-15"),
        reason: "Feriado",
      },
      new UniqueEntityId("exception-1"),
    );

    inMemoryScheduleExceptionsRepository.items.push(exception);

    // 2. Execução: O sistema tenta deletar usando a nossa regra de negócio
    const result = await sut.execute({
      exceptionId: "exception-1",
    });

    // 3. Verificação: Sucesso e repositório vazio
    expect(result.isRight()).toBe(true);
    expect(inMemoryScheduleExceptionsRepository.items).toHaveLength(0);
  });

  it("should not be able to delete a non-existing schedule exception", async () => {
    // 1. Execução: Tentamos deletar um ID que não existe
    const result = await sut.execute({
      exceptionId: "fake-id",
    });

    // 2. Verificação: Deve falhar e retornar o Error
    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(Error);
  });
});
