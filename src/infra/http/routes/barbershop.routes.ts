import { Router } from "express";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeCreateBarbershopController } from "../factories/make-create-barbershop-controller";
import { makeDeactivateUnitMembershipController } from "../factories/make-deactivate-unit-membership-controller";
import { makeGetBarbershopController } from "../factories/make-get-barbershop-controller";
import { makeGetUnitTeamMemberController } from "../factories/make-get-unit-team-member-controller";
import { makeCreateBarberRegistrationController } from "../factories/make-create-barber-registration-controller";
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
import { makeGetBarbershopLocationController } from "../factories/make-get-barbershop-location-controller";
import { makeUpdateBarbershopLocationController } from "../factories/make-update-barbershop-location-controller";
import { makeUpdateBarbershopLogoController } from "../factories/make-update-barbershop-logo-controller";
import { makeUpdateBarbershopGoogleUrlController } from "../factories/make-update-barbershop-google-url-controller";
import {
  makeListBarbershopGalleryController,
  makeAddBarbershopGalleryPhotoController,
  makeRemoveBarbershopGalleryPhotoController,
  makeReorderBarbershopGalleryController,
  makeSetBarbershopGalleryCoverController,
} from "../factories/make-barbershop-gallery-controllers";
import { makeListBarbershopReviewsController } from "../factories/make-list-barbershop-reviews-controller";
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
barbershopRoutes.get(
  "/:shopId/team/:membershipId",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetUnitTeamMemberController()),
);
barbershopRoutes.post(
  "/:shopId/barber-registrations",
  ensureUserIsAuthenticated,
  adaptRoute(makeCreateBarberRegistrationController()),
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
barbershopRoutes.get(
  "/:shopId/location",
  ensureUserIsAuthenticated,
  adaptRoute(makeGetBarbershopLocationController()),
);
barbershopRoutes.patch(
  "/:shopId/location",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateBarbershopLocationController()),
);
barbershopRoutes.patch(
  "/:shopId/logo",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateBarbershopLogoController()),
);
barbershopRoutes.delete(
  "/:shopId/logo",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateBarbershopLogoController()),
);
barbershopRoutes.patch(
  "/:shopId/google-url",
  ensureUserIsAuthenticated,
  adaptRoute(makeUpdateBarbershopGoogleUrlController()),
);
barbershopRoutes.get(
  "/:shopId/gallery",
  adaptRoute(makeListBarbershopGalleryController()),
);
barbershopRoutes.post(
  "/:shopId/gallery",
  ensureUserIsAuthenticated,
  adaptRoute(makeAddBarbershopGalleryPhotoController()),
);
barbershopRoutes.delete(
  "/:shopId/gallery/:galleryItemId",
  ensureUserIsAuthenticated,
  adaptRoute(makeRemoveBarbershopGalleryPhotoController()),
);
barbershopRoutes.patch(
  "/:shopId/gallery/reorder",
  ensureUserIsAuthenticated,
  adaptRoute(makeReorderBarbershopGalleryController()),
);
barbershopRoutes.patch(
  "/:shopId/gallery/:galleryItemId/cover",
  ensureUserIsAuthenticated,
  adaptRoute(makeSetBarbershopGalleryCoverController()),
);
barbershopRoutes.get(
  "/:shopId/reviews",
  adaptRoute(makeListBarbershopReviewsController()),
);
barbershopRoutes.use("/:shopId/services", serviceRoutes);

export { barbershopRoutes };
