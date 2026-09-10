import type { ScheduleExceptionsRepository } from "@/domain/application/repositories/schedule-exceptions-repository";
import type { ScheduleException } from "@/domain/enterprise/entities/schedule-exception";

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

  async delete(exception: ScheduleException): Promise<void> {
    const itemIndex = this.items.findIndex(
      (item) => item.id.toString() === exception.id.toString(),
    );

    if (itemIndex >= 0) {
      this.items.splice(itemIndex, 1);
    }
  }
}
