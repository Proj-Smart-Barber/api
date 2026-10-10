import { type Either, left, right } from "../../../../../core/logic/either";
import type { NotificationsRepository } from "../../../repositories/notifications-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { FetchUserNotificationsDTO } from "./fetch-user-notifications-dto";
import type { FetchUserNotificationsResponse } from "./fetch-user-notifications-response";

type FetchUserNotificationsUseCaseResponse = Either<
  ResourceNotFoundError,
  FetchUserNotificationsResponse
>;

export class FetchUserNotificationsUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private notificationsRepository: NotificationsRepository,
  ) {}

  async execute({
    userId,
  }: FetchUserNotificationsDTO): Promise<FetchUserNotificationsUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError());
    }

    const notifications =
      await this.notificationsRepository.findManyByUserId(userId);

    return right({
      notifications: notifications.map((notification) => ({
        id: notification.id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        referenceType: notification.referenceType ?? null,
        referenceId: notification.referenceId?.toString() ?? null,
        readAt: notification.readAt ?? null,
        scheduledAt: notification.scheduledAt,
        createdAt: notification.createdAt ?? null,
      })),
    });
  }
}
