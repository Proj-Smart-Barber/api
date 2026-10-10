import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { FetchUserInvitationsUseCase } from "./fetch-user-invitations";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryInvitationsRepository: InMemoryInvitationsRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: FetchUserInvitationsUseCase;

describe("Fetch user invitations use case", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryInvitationsRepository = new InMemoryInvitationsRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();

    sut = new FetchUserInvitationsUseCase(
      inMemoryUsersRepository,
      inMemoryInvitationsRepository,
      inMemoryBarbershopsRepository,
    );

    inMemoryBarbershopsRepository.items.push(
      Barbershop.create(
        {
          name: "Barbearia do Carlos",
          ownerId: new UniqueEntityId("owner-1"),
          timezone: "America/Sao_Paulo",
          slug: Slug.create("barbearia-do-carlos"),
          cnpj: "12345678901234",
          location: "Rua Teste, 123",
          status: "ACTIVE",
        },
        new UniqueEntityId("shop-1"),
      ),
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

  function addInvitation(
    email: string,
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED",
  ) {
    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-1"),
      email,
      role: Role.BARBERMAN,
      tokenHash: hashToken(`${email}-${status}`),
      status,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      invitedById: new UniqueEntityId("owner-1"),
    });
    inMemoryInvitationsRepository.items.push(invitation);

    return invitation;
  }

  it("should list pending invitations for the authenticated user email", async () => {
    const user = await createUser("joao@example.com");
    addInvitation("joao@example.com", "PENDING");
    addInvitation("outra@example.com", "PENDING");

    const response = await sut.execute({
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitations).toHaveLength(1);
      expect(response.value.invitations[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          barbershopId: "shop-1",
          barbershopName: "Barbearia do Carlos",
          status: "PENDING",
          role: "BARBERMAN",
          expiresAt: expect.any(Date),
        }),
      );
    }
  });

  it("should filter out non-pending invitations", async () => {
    const user = await createUser("joao@example.com");
    addInvitation("joao@example.com", "ACCEPTED");
    addInvitation("joao@example.com", "DECLINED");
    addInvitation("joao@example.com", "PENDING");

    const response = await sut.execute({
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitations).toHaveLength(1);
      expect(response.value.invitations[0].status).toBe("PENDING");
    }
  });

  it("should match invitations case-insensitively against the user email", async () => {
    const user = await createUser("Joao@Example.com");
    addInvitation("joao@example.com", "PENDING");

    const response = await sut.execute({
      userId: user.id.toString(),
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitations).toHaveLength(1);
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
