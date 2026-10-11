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

  async findManyByUserId(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<Notification[]> {
    let items = this.items.filter((item) => item.userId.toString() === userId);

    items = items.sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    if (options?.cursor) {
      const cursorIndex = items.findIndex(
        (i) => i.id.toString() === options.cursor,
      );
      if (cursorIndex >= 0) {
        items = items.slice(cursorIndex + 1);
      }
    }

    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return this.items.filter(
      (item) => item.userId.toString() === userId && !item.readAt,
    ).length;
  }
}
