import { type Either, left, right } from "../../../../../core/logic/either";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

export interface MarkNotificationAsReadDTO {
  notificationId: string;
  userId: string;
}

export interface MarkNotificationAsReadResponse {
  notification: {
    id: string;
    readAt: Date | null;
  };
}

type MarkNotificationAsReadUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  MarkNotificationAsReadResponse
>;

export class MarkNotificationAsReadUseCase {
  constructor(private notificationsRepository: NotificationsRepository) {}

  async execute({
    notificationId,
    userId,
  }: MarkNotificationAsReadDTO): Promise<MarkNotificationAsReadUseCaseResponse> {
    const notification =
      await this.notificationsRepository.findById(notificationId);

    if (!notification) {
      return left(new ResourceNotFoundError());
    }

    if (notification.userId.toString() !== userId) {
      return left(new NotAllowedError());
    }

    // Idempotência: só altera se ainda não foi lida
    if (!notification.readAt) {
      notification.markAsRead(new Date());
      await this.notificationsRepository.save(notification);
    }

    return right({
      notification: {
        id: notification.id.toString(),
        readAt: notification.readAt ?? null,
      },
    });
  }
}
