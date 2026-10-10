import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Notification } from "../../../../enterprise/entities/notification";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryNotificationsRepository } from "../../../../../../test/repositories/in-memory-notifications-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { FetchUserNotificationsUseCase } from "./fetch-user-notifications";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryNotificationsRepository: InMemoryNotificationsRepository;
let sut: FetchUserNotificationsUseCase;

describe("Fetch user notifications use case", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryNotificationsRepository = new InMemoryNotificationsRepository();

    sut = new FetchUserNotificationsUseCase(
      inMemoryUsersRepository,
      inMemoryNotificationsRepository,
    );
  });

  async function createUser(email = "joao@example.com"): Promise<User> {
    const user = User.create({
      name: "João Souza",
      email,
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "11111111111",
    });
    await inMemoryUsersRepository.save(user);

    return user;
  }

  function addNotification(userId: string) {
    const notification = Notification.create({
      userId: new UniqueEntityId(userId),
      type: "INVITATION_RECEIVED",
      title: "Convite para Barbearia do Carlos",
      message:
        "Carlos Silva convidou você para fazer parte da Barbearia do Carlos no SmartBarber.",
      referenceType: "INVITATION",
      referenceId: new UniqueEntityId("invitation-1"),
      scheduledAt: new Date(),
      sentAt: new Date(),
    });
    inMemoryNotificationsRepository.items.push(notification);

    return notification;
  }

  it("should list notifications for the authenticated user", async () => {
    const user = await createUser();
    addNotification(user.id.toString());

    const response = await sut.execute({
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.notifications).toHaveLength(1);
      expect(response.value.notifications[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          type: "INVITATION_RECEIVED",
          title: "Convite para Barbearia do Carlos",
          referenceType: "INVITATION",
          referenceId: "invitation-1",
          readAt: null,
          createdAt: expect.any(Date),
        }),
      );
    }
  });

  it("should not return notifications from other users", async () => {
    const user = await createUser();
    const other = await createUser("outro@example.com");
    addNotification(other.id.toString());

    const response = await sut.execute({
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.notifications).toHaveLength(0);
    }
  });

  it("should return an error when the user does not exist", async () => {
    const response = await sut.execute({
      userId: "non-existent-user",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
