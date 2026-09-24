import type { SchedulesRepository } from "../../src/domain/application/repositories/schedules-repository";
import type { BarbershopSchedule } from "../../src/domain/enterprise/entities/barbershop-schedule";

export class InMemorySchedulesRepository implements SchedulesRepository {
  public items: BarbershopSchedule[] = [];

  async create(schedule: BarbershopSchedule): Promise<void> {
    this.items.push(schedule);
  }

  async save(schedule: BarbershopSchedule): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === schedule.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items[itemIndex] = schedule;
    }
  }

  async findById(id: string): Promise<BarbershopSchedule | null> {
    const schedule = this.items.find((item) => item.id.toString() === id);

    if (!schedule) {
      return null;
    }

    return schedule;
  }

  async findManyByBarbershopId(
    barbershopId: string,
  ): Promise<BarbershopSchedule[]> {
    return this.items.filter(
      (item) => item.barbershopId.toString() === barbershopId,
    );
  }

  async delete(schedule: BarbershopSchedule): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === schedule.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }
  }

  async bulkReplace(
    barbershopId: string,
    barbermanId: string | null,
    schedules: BarbershopSchedule[],
  ): Promise<void> {
    // Apaga os existentes do escopo
    this.items = this.items.filter((item) => {
      const matchShop = item.barbershopId.toString() === barbershopId;
      const matchBarber = barbermanId
        ? item.barbermanId?.toString() === barbermanId
        : !item.barbermanId;

      return !(matchShop && matchBarber);
    });

    // Insere os novos
    this.items.push(...schedules);
  }
}
