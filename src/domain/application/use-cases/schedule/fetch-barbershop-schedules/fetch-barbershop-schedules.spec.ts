import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { FetchBarbershopSchedulesUseCase } from "./fetch-barbershop-schedules";
import { BarbershopSchedule } from "@/domain/enterprise/entities/barbershop-schedule";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let sut: FetchBarbershopSchedulesUseCase;

describe("Fetch Barbershop Schedules", () => {
  beforeEach(() => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    sut = new FetchBarbershopSchedulesUseCase(inMemorySchedulesRepository);
  });

  it("should be able to fetch barbershop schedules", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.schedules).toHaveLength(1);
    }
  });

  it("should be able to filter schedules by barbermanId", async () => {
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
      }),
    );

    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        barbermanId: new UniqueEntityId("barber-2"),
        dayOfWeek: "TUESDAY",
        openTime: "08:00",
        closeTime: "18:00",
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.schedules).toHaveLength(1);
      expect(result.value.schedules[0].dayOfWeek).toEqual("MONDAY");
    }
  });
});
