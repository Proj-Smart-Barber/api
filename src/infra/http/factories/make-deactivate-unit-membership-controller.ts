import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { DeactivateUnitMembershipUseCase } from "../../../domain/application/use-cases/barbershop/deactivate-unit-membership/deactivate-unit-membership";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DeactivateUnitMembershipController } from "../controllers/barbershop/deactivate-unit-membership.controller";

export function makeDeactivateUnitMembershipController() {
  const membershipsRepository = new DrizzleMembershipsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();

  const useCase = new DeactivateUnitMembershipUseCase(
    membershipsRepository,
    barbershopsRepository,
    bookingsRepository,
    unitOfWork,
    usersRepository,
  );

  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const attemptService = new OperationAttemptService(
    attemptsRepository,
    unitOfWork,
  );

  return new DeactivateUnitMembershipController(useCase, attemptService);
}
