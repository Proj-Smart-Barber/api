import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { FetchBarbershopSchedulesUseCase } from "./fetch-barbershop-schedules";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { BarbershopScheduleScope } from "../../../../enterprise/entities/barbershop-schedule-scope";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";

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

  it("should return INHERIT state and general schedules as effectiveSchedules when scope is INHERIT", async () => {
    // 1. Jornada geral
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
      }),
    );

    // 2. Scope INHERIT
    await inMemorySchedulesRepository.saveScope(
      BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-inherit"),
        state: "INHERIT",
        version: 2,
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-inherit",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.state).toBe("INHERIT");
      expect(result.value.version).toBe(2);
      expect(result.value.schedules).toHaveLength(0); // customizado vazio
      expect(result.value.effectiveSchedules).toHaveLength(1); // reflete a geral
      expect(result.value.needsReview).toBe(false);
    }
  });

  it("should return CLOSED state and empty effectiveSchedules when scope is CLOSED", async () => {
    await inMemorySchedulesRepository.saveScope(
      BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-closed"),
        state: "CLOSED",
        version: 3,
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-closed",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.state).toBe("CLOSED");
      expect(result.value.version).toBe(3);
      expect(result.value.schedules).toHaveLength(0);
      expect(result.value.effectiveSchedules).toHaveLength(0);
      expect(result.value.needsReview).toBe(false);
    }
  });

  it("should signal needsReview=true for legacy barberman without custom schedules and without scope", async () => {
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
      barbermanId: "barber-legacy-ambiguous",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.state).toBe("CLOSED");
      expect(result.value.needsReview).toBe(true);
      expect(result.value.effectiveSchedules).toHaveLength(0);
    }
  });

  it("should bound CUSTOM barberman schedules to unit general opening hours in effectiveSchedules", async () => {
    // 1. Jornada geral da unidade: 09:00 as 18:00
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "MONDAY",
        openTime: "09:00",
        closeTime: "18:00",
      }),
    );

    // 2. Jornada customizada do barbeiro: 07:00 as 20:00 (mais ampla que a unidade)
    inMemorySchedulesRepository.items.push(
      BarbershopSchedule.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-custom"),
        createdBy: new UniqueEntityId("owner-1"),
        dayOfWeek: "MONDAY",
        openTime: "07:00",
        closeTime: "20:00",
      }),
    );

    await inMemorySchedulesRepository.saveScope(
      BarbershopScheduleScope.create({
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-custom"),
        state: "CUSTOM",
        version: 1,
      }),
    );

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-custom",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.state).toBe("CUSTOM");
      expect(result.value.schedules).toHaveLength(1);
      // Os horários salvos permanecem os cadastrados
      expect(result.value.schedules[0].openTime).toBe("07:00");
      expect(result.value.schedules[0].closeTime).toBe("20:00");
      // Os horários efetivos são delimitados pelo funcionamento da unidade
      expect(result.value.effectiveSchedules).toHaveLength(1);
      expect(result.value.effectiveSchedules[0].openTime).toBe("09:00");
      expect(result.value.effectiveSchedules[0].closeTime).toBe("18:00");
    }
  });
});
