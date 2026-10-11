import type { Controller } from "../../../core/infra/controller";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { GetInvitationByIdController } from "../controllers/invitations/get-invitation-by-id.controller";

export function makeGetInvitationByIdController(): Controller {
  return new GetInvitationByIdController(new DrizzleInvitationsRepository());
}
