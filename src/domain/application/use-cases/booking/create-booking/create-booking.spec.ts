import { beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryShoppingCartsRepository } from "../../../../../../test/repositories/in-memory-shopping-carts-repository";
import { Booking } from "../../../../enterprise/entities/booking";
import { ShoppingCart } from "../../../../enterprise/entities/shopping-cart";
import { BookingConflictError } from "../../_errors/booking-conflict-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { CreateBookingUseCase } from "./create-booking";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let inMemoryShoppingCartsRepository: InMemoryShoppingCartsRepository;
let sut: CreateBookingUseCase;

function makeCart(cartId = "cart-1", userId = "customer-1"): ShoppingCart {
  return ShoppingCart.create(
    {
      serviceItemId: new UniqueEntityId("service-item-1"),
      userId: new UniqueEntityId(userId),
      totalPriceInCents: 5000,
    },
    new UniqueEntityId(cartId),
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
    inMemoryShoppingCartsRepository = new InMemoryShoppingCartsRepository();
    sut = new CreateBookingUseCase(
      inMemoryBookingsRepository,
      inMemoryShoppingCartsRepository,
    );

    await inMemoryShoppingCartsRepository.seed(makeCart(), "barbershop-1");
  });

  it("should be able to create a booking", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      shoppingCartId: "cart-1",
      date: "2026-09-11",
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isRight()).toBe(true);

    if (result.isRight()) {
      const booking = result.value.booking;
      expect(inMemoryBookingsRepository.items).toHaveLength(1);
      expect(booking.barbershopId.toString()).toBe("barbershop-1");
      expect(booking.barbermanId.toString()).toBe("barberman-1");
      expect(booking.shoppingCartId.toString()).toBe("cart-1");
      expect(booking.date.toISOString()).toBe("2026-09-11T00:00:00.000Z");
      expect(booking.startTime).toBe("14:00");
      expect(booking.endTime).toBe("14:30");
    }
  });

  it("should not be able to create a booking that overlaps an existing one", async () => {
    await inMemoryBookingsRepository.create(
      makeBooking({ startTime: "14:15", endTime: "14:45" }),
    );

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      shoppingCartId: "cart-1",
      date: "2026-09-11",
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BookingConflictError);
    expect(inMemoryBookingsRepository.items).toHaveLength(1);
  });

  it("should be able to create a booking in an adjacent non-overlapping slot", async () => {
    await inMemoryBookingsRepository.create(makeBooking());

    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      shoppingCartId: "cart-1",
      date: "2026-09-11",
      startTime: "14:30",
      endTime: "15:00",
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryBookingsRepository.items).toHaveLength(2);
  });

  it("should not be able to create a booking with a non-existing shopping cart", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      shoppingCartId: "non-existing-cart",
      date: "2026-09-11",
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a booking with a shopping cart from another user", async () => {
    const result = await sut.execute({
      customerId: "another-customer",
      barbermanId: "barberman-1",
      shoppingCartId: "cart-1",
      date: "2026-09-11",
      startTime: "14:00",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should not be able to create a booking when endTime is not greater than startTime", async () => {
    const result = await sut.execute({
      customerId: "customer-1",
      barbermanId: "barberman-1",
      shoppingCartId: "cart-1",
      date: "2026-09-11",
      startTime: "14:30",
      endTime: "14:30",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(Error);
    expect(inMemoryBookingsRepository.items).toHaveLength(0);
  });
});
