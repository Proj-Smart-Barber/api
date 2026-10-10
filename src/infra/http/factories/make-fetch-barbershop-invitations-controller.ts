import type { Controller } from "../../../core/infra/controller";
import { FetchBarbershopInvitationsUseCase } from "../../../domain/application/use-cases/invitations/fetch-barbershop-invitations/fetch-barbershop-invitations";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { FetchBarbershopInvitationsController } from "../controllers/invitations/fetch-barbershop-invitations.controller";

export function makeFetchBarbershopInvitationsController(): Controller {
  const fetchBarbershopInvitationsUseCase =
    new FetchBarbershopInvitationsUseCase(
      new DrizzleBarbershopsRepository(),
      new DrizzleInvitationsRepository(),
    );

  return new FetchBarbershopInvitationsController(
    fetchBarbershopInvitationsUseCase,
  );
}
