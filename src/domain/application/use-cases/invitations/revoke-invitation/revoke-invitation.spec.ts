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
import { RevokeInvitationUseCase } from "./revoke-invitation";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let inMemoryInvitationsRepository: InMemoryInvitationsRepository;
let sut: RevokeInvitationUseCase;

describe("Revoke invitation use case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    inMemoryInvitationsRepository = new InMemoryInvitationsRepository();

    sut = new RevokeInvitationUseCase(
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

  function addPendingInvitation(barbershopId = "shop-1") {
    const invitation = Invitation.create(
      {
        barbershopId: new UniqueEntityId(barbershopId),
        email: "joao@example.com",
        role: Role.BARBERMAN,
        tokenHash: hashToken("valid-token"),
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        invitedById: new UniqueEntityId("owner-1"),
      },
      new UniqueEntityId("invitation-1"),
    );
    inMemoryInvitationsRepository.items.push(invitation);

    return invitation;
  }

  it("should allow the owner to revoke a pending invitation", async () => {
    addPendingInvitation();

    const response = await sut.execute({
      barbershopId: "shop-1",
      invitationId: "invitation-1",
      userId: "owner-1",
    });

    expect(response.isRight()).toBe(true);
    if (response.isRight()) {
      expect(response.value.invitationId).toBe("invitation-1");
      expect(response.value.status).toBe("REVOKED");
    }

    expect(inMemoryInvitationsRepository.items[0].status).toBe("REVOKED");
  });

  it("should not allow a non-owner to revoke an invitation", async () => {
    addPendingInvitation();

    const response = await sut.execute({
      barbershopId: "shop-1",
      invitationId: "invitation-1",
      userId: "other-user",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(NotAllowedError);
    expect(inMemoryInvitationsRepository.items[0].status).toBe("PENDING");
  });

  it("should not revoke an invitation that belongs to another barbershop", async () => {
    addPendingInvitation("another-shop");

    const response = await sut.execute({
      barbershopId: "shop-1",
      invitationId: "invitation-1",
      userId: "owner-1",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not revoke an already accepted invitation", async () => {
    const invitation = addPendingInvitation();
    invitation.markAccepted();

    const response = await sut.execute({
      barbershopId: "shop-1",
      invitationId: "invitation-1",
      userId: "owner-1",
    });

    expect(response.isLeft()).toBe(true);
    expect(inMemoryInvitationsRepository.items[0].status).toBe("ACCEPTED");
  });

  it("should not revoke when the barbershop does not exist", async () => {
    addPendingInvitation();

    const response = await sut.execute({
      barbershopId: "non-existent-shop",
      invitationId: "invitation-1",
      userId: "owner-1",
    });

    expect(response.isLeft()).toBe(true);
    expect(response.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
