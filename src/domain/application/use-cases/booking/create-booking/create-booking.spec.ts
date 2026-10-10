import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryServicesRepository } from "../../../../../../test/repositories/in-memory-services-repository";
import { Booking } from "../../../../enterprise/entities/booking";
import { Service } from "../../../../enterprise/entities/service";
import { BookingConflictError } from "../../_errors/booking-conflict-error";
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

function makeBooking({
  startTime = "14:00",
  endTime = "14:30",
  date = "2026-09-11",
}: {
  startTime?: string;
  endTime?: string;
  date?: string;
} = {}): Booking {
  return Booking.create({
    barbershopId: new UniqueEntityId("barbershop-1"),
    barbermanId: new UniqueEntityId("barberman-1"),
    shoppingCartId: new UniqueEntityId("cart-1"),
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
      date: "2026-09-11",
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      const booking = result.value.booking;
      expect(inMemoryBookingsRepository.items).toHaveLength(1);
      expect(inMemoryBookingsRepository.createdBundles).toHaveLength(1);
      expect(booking.barbershopId.toString()).toBe("barbershop-1");
      expect(booking.barbermanId.toString()).toBe("barberman-1");
      expect(booking.date.toISOString()).toBe("2026-09-11T00:00:00.000Z");
      expect(booking.startTime).toBe("14:00");
      expect(booking.endTime).toBe("14:30");

      const { serviceItem, cart } =
        inMemoryBookingsRepository.createdBundles[0];
      expect(serviceItem.serviceId.toString()).toBe("service-1");
      expect(serviceItem.titleSnapshot).toBe("Corte de Cabelo");
      expect(serviceItem.priceInCentsSnapshot).toBe(5000);
      expect(serviceItem.durationInMinutesSnapshot).toBe(30);
      expect(cart.userId.toString()).toBe("customer-1");
      expect(cart.totalPriceInCents).toBe(5000);
      expect(booking.shoppingCartId.toString()).toBe(cart.id.toString());
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
      date: "2026-09-11",
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingConflictError);
    expect(inMemoryBookingsRepository.items).toHaveLength(1);
    expect(inMemoryBookingsRepository.createdBundles).toHaveLength(0);
  });

  it("should be able to create a booking in an adjacent non-overlapping slot", async () => {
    await inMemoryBookingsRepository.create(makeBooking());

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      serviceId: "service-1",
      date: "2026-09-11",
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
      date: "2026-09-11",
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
      date: "2026-09-11",
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
      date: "2026-09-11",
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
      date: "2026-09-11",
      startTime: "14:30",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(Error);
    expect(inMemoryBookingsRepository.items).toHaveLength(0);
  });
});
