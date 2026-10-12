import type { Controller } from "../../../core/infra/controller";
import { LookupBookingCustomerUseCase } from "../../../domain/application/use-cases/barbershop/lookup-booking-customer/lookup-booking-customer";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { LookupBookingCustomerController } from "../controllers/barbershop/lookup-booking-customer.controller";

export function makeLookupBookingCustomerController(): Controller {
  const membershipsRepository = new DrizzleMembershipsRepository();
  const usersRepository = new DrizzleUsersRepository();
  const lookupBookingCustomerUseCase = new LookupBookingCustomerUseCase(
    membershipsRepository,
    usersRepository,
  );

  return new LookupBookingCustomerController(lookupBookingCustomerUseCase);
}
