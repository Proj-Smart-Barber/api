import type { Controller } from "../../../core/infra/controller";
import { FetchUnitBookingsUseCase } from "../../../domain/application/use-cases/barbershop/fetch-unit-bookings/fetch-unit-bookings";
import { DrizzleBookingsRepository } from "../../drizzle/repositories/drizzle-bookings-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { FetchUnitBookingsController } from "../controllers/barbershop/fetch-unit-bookings.controller";

export function makeFetchUnitBookingsController(): Controller {
  const membershipsRepository = new DrizzleMembershipsRepository();
  const bookingsRepository = new DrizzleBookingsRepository();
  const fetchUnitBookingsUseCase = new FetchUnitBookingsUseCase(
    membershipsRepository,
    bookingsRepository,
  );

  return new FetchUnitBookingsController(fetchUnitBookingsUseCase);
}
