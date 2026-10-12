import { OperationAttemptService } from "../../../domain/application/services/operation-attempt-service";
import { DrizzleOperationAttemptsRepository } from "../../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../../drizzle/services/drizzle-professional-membership-unit-of-work";
import { GetOperationAttemptController } from "../controllers/operations/get-operation-attempt.controller";

export function makeGetOperationAttemptController() {
  const attemptsRepository = new DrizzleOperationAttemptsRepository();
  const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
  const service = new OperationAttemptService(attemptsRepository, unitOfWork);

  return new GetOperationAttemptController(service);
}
