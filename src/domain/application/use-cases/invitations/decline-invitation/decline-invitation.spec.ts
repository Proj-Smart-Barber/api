import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import { DeclineInvitationUseCase } from "./decline-invitation";

let inMemoryInvitationsRepository: InMemoryInvitationsRepository;
let inMemoryUsersRepository: InMemoryUsersRepository;
let sut: DeclineInvitationUseCase;

describe("Decline invitation use case", () => {
  beforeEach(() => {
    inMemoryInvitationsRepository = new InMemoryInvitationsRepository();
    inMemoryUsersRepository = new InMemoryUsersRepository();

    sut = new DeclineInvitationUseCase(
      inMemoryInvitationsRepository,
      inMemoryUsersRepository,
    );
  });

  async function createUser(email: string): Promise<User> {
    const user = User.create({
      name: "João Souza",
      email,
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "11111111111",
    });
    await inMemoryUsersRepository.save(user);

    return user;
  }

  function addPendingInvitation(
    email: string,
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
  ) {
    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-1"),
      email,
      role: Role.BARBERMAN,
      tokenHash: hashToken("valid-token"),
      status: "PENDING",
      expiresAt,
      invitedById: new UniqueEntityId("owner-1"),
    });
    inMemoryInvitationsRepository.items.push(invitation);

    return invitation;
  }

  it("should decline a valid invitation", async () => {
    const user = await createUser("joao@example.com");
    const invitation = addPendingInvitation("joao@example.com");

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitationId).toBe(invitation.id.toString());
      expect(response.value.status).toBe("DECLINED");
    }

    expect(inMemoryInvitationsRepository.items[0].status).toBe("DECLINED");
    expect(inMemoryInvitationsRepository.items[0].respondedAt).toBeInstanceOf(
      Date,
    );
  });

  it("should not decline with an unknown token", async () => {
    const user = await createUser("joao@example.com");

    const response = await sut.execute({
      token: "unknown-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
  });

  it("should not decline when the authenticated user email differs", async () => {
    const user = await createUser("outra@example.com");
    addPendingInvitation("joao@example.com");

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
    expect(inMemoryInvitationsRepository.items[0].status).toBe("PENDING");
  });

  it("should not decline an expired invitation", async () => {
    const user = await createUser("joao@example.com");
    addPendingInvitation("joao@example.com", new Date(Date.now() - 1000));

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
  });

  it("should not decline an invitation that was already accepted", async () => {
    const user = await createUser("joao@example.com");
    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-1"),
      email: "joao@example.com",
      role: Role.BARBERMAN,
      tokenHash: hashToken("valid-token"),
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      invitedById: new UniqueEntityId("owner-1"),
    });
    invitation.markAccepted();
    inMemoryInvitationsRepository.items.push(invitation);

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
    expect(inMemoryInvitationsRepository.items[0].status).toBe("ACCEPTED");
  });
});
