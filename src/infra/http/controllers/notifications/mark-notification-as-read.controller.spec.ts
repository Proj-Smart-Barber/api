import { describe, it, expect, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import { Notification } from "../../../../domain/enterprise/entities/notification";
import { InMemoryNotificationsRepository } from "../../../../../test/repositories/in-memory-notifications-repository";
import { MarkNotificationAsReadUseCase } from "../../../../domain/application/use-cases/notifications/mark-notification-as-read/mark-notification-as-read";
import { MarkNotificationAsReadController } from "./mark-notification-as-read.controller";

describe("MarkNotificationAsReadController", () => {
  let notificationsRepository: InMemoryNotificationsRepository;
  let useCase: MarkNotificationAsReadUseCase;
  let sut: MarkNotificationAsReadController;

  beforeEach(() => {
    notificationsRepository = new InMemoryNotificationsRepository();
    useCase = new MarkNotificationAsReadUseCase(notificationsRepository);
    sut = new MarkNotificationAsReadController(useCase);
  });

  it("should return 200 with notification readAt when request is valid", async () => {
    const notifId = "11111111-1111-4111-a111-111111111111";
    const userId = "22222222-2222-4222-a222-222222222222";

    const notification = Notification.create(
      {
        userId: new UniqueEntityId(userId),
        title: "Novo Convite",
        message: "Você recebeu um convite.",
        type: "INVITATION",
        scheduledAt: new Date(),
      },
      new UniqueEntityId(notifId),
    );
    await notificationsRepository.create(notification);

    const response = await sut.handle({
      notificationId: notifId,
      userId,
    });

    expect(response.statusCode).toBe(200);
    expect((response.body as any).notification.id).toBe(notifId);
    expect((response.body as any).notification.readAt).toBeDefined();
  });

  it("reject_body_query_homonyms: rejeita 400 se userId ou notificationId forem forjados no body ou query", async () => {
    const response = await sut.handle({
      notificationId: "11111111-1111-4111-a111-111111111111",
      userId: "22222222-2222-4222-a222-222222222222",
      _body: { userId: "attacker-id" },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as any).error).toContain("Parâmetros homônimos");
  });

  it("foreign_notification_is_not_readable: retorna 403 quando pertence a outro usuário", async () => {
    const notifId = "11111111-1111-4111-a111-111111111111";
    const ownerUserId = "22222222-2222-4222-a222-222222222222";
    const otherUserId = "33333333-3333-4333-a333-333333333333";

    const notification = Notification.create(
      {
        userId: new UniqueEntityId(ownerUserId),
        title: "Aviso",
        message: "Mensagem",
        type: "INVITATION",
        scheduledAt: new Date(),
      },
      new UniqueEntityId(notifId),
    );
    await notificationsRepository.create(notification);

    const response = await sut.handle({
      notificationId: notifId,
      userId: otherUserId,
    });

    expect(response.statusCode).toBe(403);
  });
});
