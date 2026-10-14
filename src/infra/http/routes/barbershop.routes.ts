import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateBarbershopController } from "../factories/make-create-barbershop-controller";
import { makeDeactivateUnitMembershipController } from "../factories/make-deactivate-unit-membership-controller";
import { makeGetBarbershopController } from "../factories/make-get-barbershop-controller";
import { makeListBarbershopProfessionalsController } from "../factories/make-list-barbershop-professionals-controller";
import { makeListUnitTeamController } from "../factories/make-list-unit-team-controller";
import { makeLookupBookingCustomerController } from "../factories/make-lookup-booking-customer-controller";
import { makeFetchUnitBookingsController } from "../factories/make-fetch-unit-bookings-controller";
import {
  makeSearchBarbershopsController,
  makeSearchNearbyBarbershopsController,
} from "../factories/make-search-barbershops-controller";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { bookingCustomerLookupLimit } from "../middlewares/booking-customer-lookup-limit";
import { serviceRoutes } from "./service.routes";

const barbershopRoutes = Router();

barbershopRoutes.get("/", adaptRoute(makeSearchBarbershopsController()));
barbershopRoutes.post(
  "/nearby",
  adaptRoute(makeSearchNearbyBarbershopsController()),
);

barbershopRoutes.post(
  "/",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateBarbershopController()),
);
barbershopRoutes.get("/:shopId", adaptRoute(makeGetBarbershopController()));
barbershopRoutes.get(
  "/:shopId/professionals",
  adaptRoute(makeListBarbershopProfessionalsController()),
);
barbershopRoutes.get(
  "/:shopId/team",
  ensureUserIsAuthenticated,
  adaptRoute(makeListUnitTeamController()),
);
barbershopRoutes.patch(
  "/:shopId/team/:membershipId/deactivation",
  ensureUserIsAuthenticated,
  adaptRoute(makeDeactivateUnitMembershipController()),
);
barbershopRoutes.post(
  "/:shopId/customers/lookup",
  ensureUserIsAuthenticated,
  bookingCustomerLookupLimit,
  adaptRoute(makeLookupBookingCustomerController()),
);
barbershopRoutes.get(
  "/:shopId/bookings",
  ensureUserIsAuthenticated,
  adaptRoute(makeFetchUnitBookingsController()),
);
barbershopRoutes.use("/:shopId/services", serviceRoutes);

export { barbershopRoutes };
