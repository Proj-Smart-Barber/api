import type { Controller } from "../../../core/infra/controller";
import { InviteBarbermanUseCase } from "../../../domain/application/use-cases/invitations/invite-barberman/invite-barberman";
import { ResendEmailService } from "../../email/resend-email-service";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleNotificationsRepository } from "../../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { InviteBarbermanController } from "../controllers/invitations/invite-barberman.controller";

export function makeInviteBarbermanController(): Controller {
  const inviteBarbermanUseCase = new InviteBarbermanUseCase(
    new DrizzleBarbershopsRepository(),
    new DrizzleInvitationsRepository(),
    new DrizzleMembershipsRepository(),
    new DrizzleUsersRepository(),
    new ResendEmailService(),
    new DrizzleNotificationsRepository(),
  );

  return new InviteBarbermanController(inviteBarbermanUseCase);
}
