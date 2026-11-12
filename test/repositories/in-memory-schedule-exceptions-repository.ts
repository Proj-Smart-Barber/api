import type { ScheduleExceptionsRepository } from "../../src/domain/application/repositories/schedule-exceptions-repository";
import type { ScheduleException } from "../../src/domain/enterprise/entities/schedule-exception";

export class InMemoryScheduleExceptionsRepository
  implements ScheduleExceptionsRepository
{
  public items: ScheduleException[] = [];

  async create(exception: ScheduleException): Promise<void> {
    this.items.push(exception);
  }

  async save(exception: ScheduleException): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === exception.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items[itemIndex] = exception;
    }
  }

  async findById(id: string): Promise<ScheduleException | null> {
    const exception = this.items.find((item) => item.id.toString() === id);

    if (!exception) {
      return null;
    }

    return exception;
  }

  async findManyByBarbershopId(
    barbershopId: string,
  ): Promise<ScheduleException[]> {
    return this.items.filter(
      (item) => item.barbershopId.toString() === barbershopId,
    );
  }

  async findManyByBarbershopAndDate(
    barbershopId: string,
    dateStr: string,
    barbermanId?: string | null,
  ): Promise<ScheduleException[]> {
    const cleanDate = dateStr.split("T")[0];
    return this.items.filter((e) => {
      if (e.barbershopId.toString() !== barbershopId) return false;
      const eDate = new Date(e.date).toISOString().split("T")[0];
      if (eDate !== cleanDate) return false;
      if (!e.barbermanId) return true;
      return Boolean(barbermanId && e.barbermanId.toString() === barbermanId);
    });
  }

  async delete(exception: ScheduleException): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === exception.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }
  }
}
