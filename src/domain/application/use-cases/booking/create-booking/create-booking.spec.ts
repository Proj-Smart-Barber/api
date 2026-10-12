import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { Booking } from "../../../../enterprise/entities/booking";
import { Service } from "../../../../enterprise/entities/service";
import { BookingConflictError } from "../../_errors/booking-conflict-error";
import {
  QuoteChangedError,
  SlotUnavailableError,
} from "../../_errors/booking-errors";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { CreateBookingUseCase } from "./create-booking";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: CreateBookingUseCase;

function makeService(
  serviceId = "service-1",
  barbershopId = "barbershop-1",
): Service {
  return Service.create(
    {
      barbershopId: new UniqueEntityId(barbershopId),
      title: "Corte de Cabelo",
      priceInCents: 5000,
      durationInMinutes: 30,
      isActive: true,
    },
    new UniqueEntityId(serviceId),
  );
}

const FUTURE_TEST_DATE = "2027-09-11";

function makeBooking({
  startTime = "14:00",
  endTime = "14:30",
  date = FUTURE_TEST_DATE,
}: {
  startTime?: string;
  endTime?: string;
  date?: string;
} = {}): Booking {
  const startsAt = new Date(`${date}T${startTime}:00-03:00`);
  const endsAt = new Date(`${date}T${endTime}:00-03:00`);
  return Booking.create({
    barbershopId: new UniqueEntityId("barbershop-1"),
    barbermanId: new UniqueEntityId("barberman-1"),
    shoppingCartId: new UniqueEntityId("cart-1"),
    startsAt,
    endsAt,
    date: new Date(`${date}T00:00:00.000Z`),
    startTime,
    endTime,
  });
}

describe("Create Booking Use Case", () => {
  beforeEach(async () => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new CreateBookingUseCase(
      inMemoryBookingsRepository,
      inMemoryServicesRepository,
    );

    await inMemoryServicesRepository.create(makeService());
  });

  it("should be able to create a booking from a service", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-1",
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      const booking = result.value.booking;
      expect(inMemoryBookingsRepository.items).toHaveLength(1);
      const items = inMemoryBookingsRepository.bookingItems.get(
        booking.id.toString(),
      );
      expect(items).toBeDefined();
      expect(items).toHaveLength(1);
      expect(booking.barbershopId.toString()).toBe("barbershop-1");
      expect(booking.barbermanId.toString()).toBe("barberman-1");
      expect(booking.date.toISOString()).toBe(
        `${FUTURE_TEST_DATE}T00:00:00.000Z`,
      );
      expect(booking.startTime).toBe("14:00");
      expect(booking.endTime).toBe("14:30");

      const serviceItem = items![0];
      expect(serviceItem.serviceId?.toString()).toBe("service-1");
      expect(serviceItem.title).toBe("Corte de Cabelo");
      expect(serviceItem.priceInCents).toBe(5000);
      expect(serviceItem.durationInMinutes).toBe(30);
      expect(booking.totalPriceInCents).toBe(5000);
      expect(booking.totalDurationInMinutes).toBe(30);
    }
  });

  it("should not be able to create a booking that overlaps an existing one", async () => {
    await inMemoryBookingsRepository.create(
      makeBooking({ startTime: "14:15", endTime: "14:45" }),
    );

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-1",
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(SlotUnavailableError);
    expect(inMemoryBookingsRepository.items).toHaveLength(1);
  });

  it("should be able to create a booking in an adjacent non-overlapping slot", async () => {
    await inMemoryBookingsRepository.create(makeBooking());

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-1",
      date: FUTURE_TEST_DATE,
      startTime: "14:30",
      endTime: "15:00",
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryBookingsRepository.items).toHaveLength(2);
  });

  it("should derive the barbershop from the service and reject an unowned booking attempt", async () => {
    await inMemoryServicesRepository.create(
      makeService("service-2", "barbershop-2"),
    );

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-2",
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      expect(result.value.booking.barbershopId.toString()).toBe("barbershop-2");
    }
  });

  it("should not be able to create a booking with a non-existing service", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "non-existing-service",
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a booking with an inactive service", async () => {
    const inactiveService = makeService("service-inactive");
    inactiveService.deactivate();
    await inMemoryServicesRepository.create(inactiveService);

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-inactive",
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(inMemoryBookingsRepository.createdBundles).toHaveLength(0);
  });

  it("should not be able to create a booking when endTime is not greater than startTime", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-1",
      date: FUTURE_TEST_DATE,
      startTime: "14:30",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(Error);
    expect(inMemoryBookingsRepository.items).toHaveLength(0);
  });

  it("multiple_services_use_one_post: deve calcular duração combinada e preço total para múltiplos serviços", async () => {
    const service2 = Service.create(
      {
        barbershopId: new UniqueEntityId("barbershop-1"),
        title: "Barba Terapia",
        priceInCents: 3500,
        durationInMinutes: 20,
        isActive: true,
      },
      new UniqueEntityId("service-2"),
    );
    await inMemoryServicesRepository.create(service2);

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceIds: ["service-1", "service-2"],
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.booking.startTime).toBe("14:00");
      expect(result.value.booking.endTime).toBe("14:50"); // 30min + 20min = 50min
    }
  });

  it("quote_change_rejects_booking: rejeita com BookingConflictError se preço esperado diferir do calculado", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceIds: ["service-1"],
      date: FUTURE_TEST_DATE,
      startTime: "14:00",
      expectedTotalPriceInCents: 9999, // diferente de 5000
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteChangedError);
  });
});
