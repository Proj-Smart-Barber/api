import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { AlreadyAMemberError } from "../../_errors/already-a-member-error";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";
import { AcceptInvitationUseCase } from "./accept-invitation";

let inMemoryInvitationsRepository: InMemoryInvitationsRepository;
let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryMembershipsRepository: InMemoryMembershipsRepository;
let sut: AcceptInvitationUseCase;

describe("Accept invitation use case", () => {
  beforeEach(() => {
    inMemoryInvitationsRepository = new InMemoryInvitationsRepository();
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryMembershipsRepository = new InMemoryMembershipsRepository();

    sut = new AcceptInvitationUseCase(
      inMemoryInvitationsRepository,
      inMemoryUsersRepository,
      inMemoryMembershipsRepository,
    );
  });

  async function createUser(
    name: string,
    email: string,
    cpf: string,
  ): Promise<User> {
    const user = User.create({
      name,
      email,
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf,
    });
    await inMemoryUsersRepository.save(user);

    return user;
  }

  function addPendingInvitation(email: string, expiresAt = futureDate()) {
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

  function futureDate(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  it("should accept a valid invitation and create a BARBERMAN membership", async () => {
    const user = await createUser(
      "João Souza",
      "joao@example.com",
      "11111111111",
    );
    const invitation = addPendingInvitation("joao@example.com");

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitationId).toBe(invitation.id.toString());
      expect(response.value.barbershopId).toBe("shop-1");
      expect(response.value.barbermanId).toBe(user.id.toString());
      expect(response.value.status).toBe("ACCEPTED");
    }

    expect(inMemoryInvitationsRepository.items[0].status).toBe("ACCEPTED");
    expect(inMemoryMembershipsRepository.items).toHaveLength(1);
    expect(inMemoryMembershipsRepository.items[0].role).toBe(Role.BARBERMAN);
    expect(inMemoryMembershipsRepository.items[0].barbershopId.toString()).toBe(
      "shop-1",
    );
    expect(inMemoryMembershipsRepository.items[0].userId.toString()).toBe(
      user.id.toString(),
    );
  });

  it("should normalize email casing when matching the invited email", async () => {
    const user = await createUser(
      "João Souza",
      "Joao@Example.com",
      "11111111111",
    );
    addPendingInvitation("joao@example.com");

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
  });

  it("should not accept with an unknown token", async () => {
    const user = await createUser(
      "João Souza",
      "joao@example.com",
      "11111111111",
    );

    const response = await sut.execute({
      token: "unknown-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
    expect(inMemoryMembershipsRepository.items).toHaveLength(0);
  });

  it("should not accept when the authenticated user email differs from the invitation", async () => {
    const user = await createUser(
      "Outra Pessoa",
      "outra@example.com",
      "11111111111",
    );
    addPendingInvitation("joao@example.com");

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
    expect(inMemoryMembershipsRepository.items).toHaveLength(0);
  });

  it("should not accept an expired invitation", async () => {
    const user = await createUser(
      "João Souza",
      "joao@example.com",
      "11111111111",
    );
    addPendingInvitation("joao@example.com", new Date(Date.now() - 60 * 1000));

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
    expect(inMemoryMembershipsRepository.items).toHaveLength(0);
  });

  it("should not accept an invitation that was already responded to", async () => {
    const user = await createUser(
      "João Souza",
      "joao@example.com",
      "11111111111",
    );
    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-1"),
      email: "joao@example.com",
      role: Role.BARBERMAN,
      tokenHash: hashToken("valid-token"),
      status: "PENDING",
      expiresAt: futureDate(),
      invitedById: new UniqueEntityId("owner-1"),
    });
    invitation.markDeclined();
    inMemoryInvitationsRepository.items.push(invitation);

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(InvalidInvitationError);
    expect(inMemoryMembershipsRepository.items).toHaveLength(0);
  });

  it("should not accept when the user is already a member of the barbershop", async () => {
    const user = await createUser(
      "João Souza",
      "joao@example.com",
      "11111111111",
    );
    addPendingInvitation("joao@example.com");

    inMemoryMembershipsRepository.items.push(
      Membership.create({
        role: Role.BARBERMAN,
        barbershopId: new UniqueEntityId("shop-1"),
        userId: user.id,
      }),
    );

    const response = await sut.execute({
      token: "valid-token",
      userId: user.id.toString(),
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(AlreadyAMemberError);
  });
});
