import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { FetchScheduleExceptionsUseCase } from "./fetch-schedule-exceptions";
import { ScheduleException } from "../../../../enterprise/entities/schedule-exception";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";

let inMemoryScheduleExceptionsRepository: InMemoryScheduleExceptionsRepository;
let sut: FetchScheduleExceptionsUseCase;

describe("Fetch Schedule Exceptions", () => {
  beforeEach(() => {
    inMemoryScheduleExceptionsRepository =
      new InMemoryScheduleExceptionsRepository();
    sut = new FetchScheduleExceptionsUseCase(
      inMemoryScheduleExceptionsRepository,
    );
  });

  it("should be able to fetch schedule exceptions", async () => {
    inMemoryScheduleExceptionsRepository.items.push(
      ScheduleException.create({
        barbershopId: new UniqueEntityId("shop-1"),
        date: new Date("2026-09-15"),
        reason: "Holiday",
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.exceptions).toHaveLength(1);
    }
  });
});
