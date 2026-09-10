import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Booking } from "../../../../enterprise/entities/booking";
import { GetAvailableSlotsUseCase } from "./get-available-slots";

let inMemoryBookingsRepository: InMemoryBookingsRepository;
let sut: GetAvailableSlotsUseCase;

describe("Get Available Slots Use Case", () => {
  beforeEach(() => {
    inMemoryBookingsRepository = new InMemoryBookingsRepository();
    sut = new GetAvailableSlotsUseCase(inMemoryBookingsRepository);
  });

  it("deve ser possível calcular e listar os horários livres para agendamento", async () => {
    const booking = Booking.create(
      {
        barbershopId: new UniqueEntityId("shop-1"),
        barbermanId: new UniqueEntityId("barber-1"),
        shoppingCartId: new UniqueEntityId("cart-1"),
      },
      new UniqueEntityId("booking-1"),
    );

    await inMemoryBookingsRepository.create(booking);

    // Consulta para a data exata da criação da entidade
    const currentDate = booking.createdAt;

    if (!currentDate) {
      throw "Data não definida";
    }

    const result = await sut.execute({
      barbershopId: "shop-1",
      barbermanId: "barber-1",
      date: currentDate,
      serviceDurationInMinutes: 30,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.slots.length).toBeGreaterThan(0);

      // Verifica que o slot referente ao horário do agendamento foi removido da lista
      const occupiedSlot = result.value.slots.find((slot) => {
        const slotDate = new Date(slot.start);
        return (
          slotDate.getHours() === currentDate.getHours() &&
          slotDate.getMinutes() === currentDate.getMinutes()
        );
      });

      expect(occupiedSlot).toBeUndefined();
    }
  });
});
