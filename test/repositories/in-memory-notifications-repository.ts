import type { NotificationsRepository } from "../../src/domain/application/repositories/notifications-repository";
import type { Notification } from "../../src/domain/enterprise/entities/notification";

export class InMemoryNotificationsRepository
  implements NotificationsRepository
{
  public items: Notification[] = [];

  async create(notification: Notification): Promise<Notification> {
    this.items.push(notification);

    return notification;
  }

  async save(notification: Notification): Promise<Notification> {
    const index = this.items.findIndex(
      (item) => item.id.toString() === notification.id.toString(),
    );

    if (index >= 0) {
      this.items[index] = notification;
    }

    return notification;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id.toString() !== id);
  }

  async findById(id: string): Promise<Notification | null> {
    const notification = this.items.find((item) => item.id.toString() === id);

    return notification ?? null;
  }

  async findManyByUserId(userId: string): Promise<Notification[]> {
    return this.items.filter((item) => item.userId.toString() === userId);
  }
}
