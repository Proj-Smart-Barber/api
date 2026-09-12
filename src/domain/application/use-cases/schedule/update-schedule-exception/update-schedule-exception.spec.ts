import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { UpdateScheduleExceptionUseCase } from "./update-schedule-exception";
import { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { NotAllowedError } from "@/domain/application/use-cases/_errors/not-allowed-error";

let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let sut: UpdateScheduleExceptionUseCase;

describe("Update Schedule Exception", () => {
  beforeEach(() => {
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    sut = new UpdateScheduleExceptionUseCase(
      inMemoryScheduleExceptionsRepository,
    );
  });

  it("should be able to update a schedule exception", async () => {
    const newException = ScheduleException.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        date: new Date("2026-09-15"),
        startTime: "09:00",
        endTime: "10:00",
      },
      new UniqueEntityId("exception-1"),
    );

    inMemoryScheduleExceptionsRepository.items.push(newException);

    const result = await sut.execute({
      exceptionId: "exception-1",
      barbershopId: "shop-1",
      startTime: "10:00",
      endTime: "11:00",
      reason: "Changed reason",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.scheduleException.startTime).toBe("10:00");
      expect(result.value.scheduleException.endTime).toBe("11:00");
      expect(result.value.scheduleException.reason).toBe("Changed reason");
    }
  });

  it("should not be able to update an exception from another barbershop", async () => {
    const newException = ScheduleException.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        date: new Date("2026-09-15"),
      },
      new UniqueEntityId("exception-1"),
    );

    inMemoryScheduleExceptionsRepository.items.push(newException);

    const result = await sut.execute({
      exceptionId: "exception-1",
      barbershopId: "shop-2",
      startTime: "10:00",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
