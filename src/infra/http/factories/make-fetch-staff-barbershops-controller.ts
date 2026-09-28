import type { Controller } from "../../../core/infra/controller";
import { FetchStaffBarbershopsUseCase } from "../../../domain/application/use-cases/staff/fetch-staff-barbershops/fetch-staff-barbershops";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { FetchStaffBarbershopsController } from "../controllers/staff/fetch-staff-barbershops.controller";

export function makeFetchStaffBarbershopsController(): Controller {
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const fetchStaffBarbershopsUseCase = new FetchStaffBarbershopsUseCase(
    barbershopsRepository,
  );

  return new FetchStaffBarbershopsController(fetchStaffBarbershopsUseCase);
}
