import { hashToken } from "../../../../../core/crypto/token";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Invitation } from "../../../../enterprise/entities/invitation";
import { Role } from "../../../../enterprise/entities/membership";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryInvitationsRepository } from "../../../../../../test/repositories/in-memory-invitations-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { FetchBarbershopInvitationsUseCase } from "./fetch-barbershop-invitations";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryInvitationsRepository: InMemoryInvitationsRepository;
let sut: FetchBarbershopInvitationsUseCase;

describe("Fetch barbershop invitations use case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryInvitationsRepository = new InMemoryInvitationsRepository();

    sut = new FetchBarbershopInvitationsUseCase(
      inMemoryBarbershopsRepository,
      inMemoryInvitationsRepository,
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

  function addInvitation(
    email: string,
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED",
  ): Invitation {
    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-1"),
      email,
      role: Role.BARBERMAN,
      tokenHash: hashToken(email),
      status,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      invitedById: new UniqueEntityId("owner-1"),
    });
    inMemoryInvitationsRepository.items.push(invitation);

    return invitation;
  }

  it("should list all invitations of a barbershop for the owner", async () => {
    addInvitation("joao@example.com", "PENDING");
    addInvitation("pedro@example.com", "ACCEPTED");

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: "owner-1",
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitations).toHaveLength(2);
      expect(response.value.invitations[0]).toEqual(
        expect.objectContaining({
          email: "joao@example.com",
          status: "PENDING",
          role: "BARBERMAN",
          expiresAt: expect.any(Date),
        }),
      );
    }
  });

  it("should not allow a non-owner to list invitations", async () => {
    addInvitation("joao@example.com", "PENDING");

    const response = await sut.execute({
      barbershopId: "shop-1",
      userId: "barberman-1",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(NotAllowedError);
  });

  it("should return an error when the barbershop does not exist", async () => {
    const response = await sut.execute({
      barbershopId: "non-existent-shop",
      userId: "owner-1",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
