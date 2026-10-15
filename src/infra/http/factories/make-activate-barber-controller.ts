import { ActivateBarberRegistrationUseCase } from "../../../domain/application/use-cases/barbershop/activate-barber-registration/activate-barber-registration";
import { DrizzleBarberRegistrationsRepository } from "../../drizzle/repositories/drizzle-barber-registrations-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { ActivateBarberController } from "../controllers/barbershop/activate-barber.controller";

export function makeActivateBarberController() {
  const barberRegistrationsRepository =
    new DrizzleBarberRegistrationsRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const usersRepository = new DrizzleUsersRepository();

  const useCase = new ActivateBarberRegistrationUseCase(
    barberRegistrationsRepository,
    invitationsRepository,
    usersRepository,
  );

  return new ActivateBarberController(useCase);
}
