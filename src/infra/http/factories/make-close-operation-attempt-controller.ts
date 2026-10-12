import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { CloseOperationAttemptController } from "../controllers/operations/close-operation-attempt.controller";

export function makeCloseOperationAttemptController() {
  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const service = new OperationAttemptService(attemptsRepository, unitOfWork);

  return new CloseOperationAttemptController(service);
}
