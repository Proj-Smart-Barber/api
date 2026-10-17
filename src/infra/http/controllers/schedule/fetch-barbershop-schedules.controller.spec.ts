import { InMemorySchedulesRepository } from "../../../../../test/repositories/in-memory-schedules-repository";
import { FetchBarbershopSchedulesUseCase } from "../../../../domain/application/use-cases/schedule/fetch-barbershop-schedules/fetch-barbershop-schedules";
import { FetchBarbershopSchedulesController } from "./fetch-barbershop-schedules.controller";
import { BarbershopSchedule } from "../../../../domain/enterprise/entities/barbershop-schedule";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";

describe("FetchBarbershopSchedulesController (TEC-17)", () => {
  let schedulesRepository: InMemorySchedulesRepository;
  let useCase: FetchBarbershopSchedulesUseCase;
  let sut: FetchBarbershopSchedulesController;

  beforeEach(async () => {
    schedulesRepository = new InMemorySchedulesRepository();
    useCase = new FetchBarbershopSchedulesUseCase(schedulesRepository);
    sut = new FetchBarbershopSchedulesController(useCase);

    await schedulesRepository.create(
      BarbershopSchedule.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          createdBy: new UniqueEntityId("owner-1"),
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
          barbermanId: null,
        },
        new UniqueEntityId("sched-general-1"),
      ),
    );

    await schedulesRepository.create(
      BarbershopSchedule.create(
        {
          barbershopId: new UniqueEntityId("shop-1"),
          createdBy: new UniqueEntityId("barber-1"),
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
          barbermanId: new UniqueEntityId("barber-1"),
        },
        new UniqueEntityId("sched-barber-1"),
      ),
    );
  });

  it("should return all unit schedules (general with barbermanId: null and individual) when barbermanId is omitted", async () => {
    const response = await sut.handle({
      shopId: "shop-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      schedules: [
        {
          id: "sched-general-1",
          barbershopId: "shop-1",
          barbermanId: null,
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
        {
          id: "sched-barber-1",
          barbershopId: "shop-1",
          barbermanId: "barber-1",
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });
  });

  it("should return only the individual schedules of the professional when barbermanId is provided", async () => {
    const response = await sut.handle({
      shopId: "shop-1",
      barbermanId: "barber-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      schedules: [
        {
          id: "sched-barber-1",
          barbershopId: "shop-1",
          barbermanId: "barber-1",
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "17:00",
        },
      ],
    });
  });

  it("should return 400 when shopId is missing", async () => {
    const response = await sut.handle({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });
});
