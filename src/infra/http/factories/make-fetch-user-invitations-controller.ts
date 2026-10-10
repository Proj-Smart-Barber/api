import type { Controller } from "../../../core/infra/controller";
import { FetchUserInvitationsUseCase } from "../../../domain/application/use-cases/invitations/fetch-user-invitations/fetch-user-invitations";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { FetchUserInvitationsController } from "../controllers/invitations/fetch-user-invitations.controller";

export function makeFetchUserInvitationsController(): Controller {
  const fetchUserInvitationsUseCase = new FetchUserInvitationsUseCase(
    new DrizzleUsersRepository(),
    new DrizzleInvitationsRepository(),
    new DrizzleBarbershopsRepository(),
  );

  return new FetchUserInvitationsController(fetchUserInvitationsUseCase);
}
