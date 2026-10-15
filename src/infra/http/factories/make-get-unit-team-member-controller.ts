import { GetUnitTeamMemberUseCase } from "../../../domain/application/use-cases/barbershop/get-unit-team-member/get-unit-team-member";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { GetUnitTeamMemberController } from "../controllers/barbershop/get-unit-team-member.controller";

export function makeGetUnitTeamMemberController() {
  const membershipsRepository = new DrizzleMembershipsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const useCase = new GetUnitTeamMemberUseCase(
    membershipsRepository,
    barbershopsRepository,
    usersRepository,
  );

  return new GetUnitTeamMemberController(useCase);
}
