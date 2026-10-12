import { ListUnitTeamUseCase } from "../../../domain/application/use-cases/barbershop/list-unit-team/list-unit-team";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { ListUnitTeamController } from "../controllers/barbershop/list-unit-team.controller";

export function makeListUnitTeamController() {
  const membershipsRepository = new DrizzleMembershipsRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const useCase = new ListUnitTeamUseCase(
    membershipsRepository,
    barbershopsRepository,
  );

  return new ListUnitTeamController(useCase);
}
