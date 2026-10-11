import { describe, beforeEach, it, expect } from "vitest";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import { InMemoryInvitationsRepository } from "../../../../../test/repositories/in-memory-invitations-repository";
import { InMemoryMembershipsRepository } from "../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../test/repositories/in-memory-users-repository";
import { Invitation } from "../../../../domain/enterprise/entities/invitation";
import { Role } from "../../../../domain/enterprise/entities/membership";
import { User } from "../../../../domain/enterprise/entities/user";
import { Password } from "../../../../domain/enterprise/entities/value-objects/password";
import { RespondToInvitationUseCase } from "../../../../domain/application/use-cases/invitations/respond-to-invitation/respond-to-invitation";
import { AcceptInvitationByIdController } from "./accept-invitation-by-id.controller";
import { DeclineInvitationByIdController } from "./decline-invitation-by-id.controller";

let invitationsRepository: InMemoryInvitationsRepository;
let usersRepository: InMemoryUsersRepository;
let membershipsRepository: InMemoryMembershipsRepository;
let respondUseCase: RespondToInvitationUseCase;
let acceptController: AcceptInvitationByIdController;
let declineController: DeclineInvitationByIdController;

describe("Invitations By ID Controllers", () => {
  beforeEach(() => {
    invitationsRepository = new InMemoryInvitationsRepository();
    usersRepository = new InMemoryUsersRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    respondUseCase = new RespondToInvitationUseCase(
      invitationsRepository,
      usersRepository,
      membershipsRepository,
    );
    acceptController = new AcceptInvitationByIdController(respondUseCase);
    declineController = new DeclineInvitationByIdController(respondUseCase);
  });

  it("id_route_uses_actor_and_path and accepts successfully", async () => {
    const user = User.create({
      name: "Barbeiro Convidado",
      email: "barbeiro@test.com",
      password: Password.create("hash"),
      cpf: "11122233344",
      accountType: "CLIENT",
    });
    await usersRepository.save(user);

    const invitation = Invitation.create({
      barbershopId: new UniqueEntityId("shop-001"),
      email: "barbeiro@test.com",
      role: Role.BARBERMAN,
      tokenHash: "token-hash-1",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 100000),
      invitedById: new UniqueEntityId("owner-001"),
    });
    invitationsRepository.items.push(invitation);

    const response = await acceptController.handle({
      invitationId: invitation.id.toString(),
      userId: user.id.toString(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      accepted: true,
      invitationId: invitation.id.toString(),
      barbershopId: "shop-001",
      barbermanId: user.id.toString(),
      status: "ACCEPTED",
    });
  });

  it("reject_body_query_homonyms when body or query contains forged userId", async () => {
    const responseWithBodyHomonym = await acceptController.handle({
      invitationId: "00000000-0000-0000-0000-000000000001",
      userId: "00000000-0000-0000-0000-000000000002",
      body: {
        userId: "forged-id",
      },
    });

    expect(responseWithBodyHomonym.statusCode).toBe(400);

    const responseWithQueryHomonym = await declineController.handle({
      invitationId: "00000000-0000-0000-0000-000000000001",
      userId: "00000000-0000-0000-0000-000000000002",
      query: {
        invitationId: "forged-invitation-id",
      },
    });

    expect(responseWithQueryHomonym.statusCode).toBe(400);
  });
});
