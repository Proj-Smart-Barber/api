import { describe, it, expect, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Notification } from "../../../../enterprise/entities/notification";
import { InMemoryNotificationsRepository } from "../../../../../../test/repositories/in-memory-notifications-repository";
import { MarkNotificationAsReadUseCase } from "./mark-notification-as-read";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

describe("MarkNotificationAsReadUseCase", () => {
  let notificationsRepository: InMemoryNotificationsRepository;
  let sut: MarkNotificationAsReadUseCase;

  beforeEach(() => {
    notificationsRepository = new InMemoryNotificationsRepository();
    sut = new MarkNotificationAsReadUseCase(notificationsRepository);
  });

  it("should mark an unread notification as read", async () => {
    const notification = Notification.create({
      userId: new UniqueEntityId("user-1"),
      title: "Convite recebido",
      message: "Você foi convidado para a barbearia.",
      type: "INVITATION",
      scheduledAt: new Date(),
    });
    await notificationsRepository.create(notification);

    const result = await sut.execute({
      notificationId: notification.id.toString(),
      userId: "user-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.notification.id).toBe(notification.id.toString());
      expect(result.value.notification.readAt).toBeInstanceOf(Date);
    }

    const inRepo = await notificationsRepository.findById(
      notification.id.toString(),
    );
    expect(inRepo?.readAt).toBeDefined();
  });

  it("repeat_read_preserves_first_timestamp: repetição de leitura preserva a data original", async () => {
    const initialReadAt = new Date("2026-10-10T12:00:00.000Z");
    const notification = Notification.create({
      userId: new UniqueEntityId("user-1"),
      title: "Convite recebido",
      message: "Você foi convidado para a barbearia.",
      type: "INVITATION",
      scheduledAt: new Date(),
      readAt: initialReadAt,
    });
    await notificationsRepository.create(notification);

    const result = await sut.execute({
      notificationId: notification.id.toString(),
      userId: "user-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.notification.readAt?.toISOString()).toBe(
        initialReadAt.toISOString(),
      );
    }
  });

  it("foreign_notification_is_not_readable: usuário estranho não pode marcar notificação alheia como lida", async () => {
    const notification = Notification.create({
      userId: new UniqueEntityId("user-owner"),
      title: "Convite",
      message: "Mensagem",
      type: "INVITATION",
      scheduledAt: new Date(),
    });
    await notificationsRepository.create(notification);

    const result = await sut.execute({
      notificationId: notification.id.toString(),
      userId: "attacker-user-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should return ResourceNotFoundError when notification does not exist", async () => {
    const result = await sut.execute({
      notificationId: "non-existent-id",
      userId: "user-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
