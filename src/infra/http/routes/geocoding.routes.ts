import { Router } from "express";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { adaptRoute } from "../../../core/infra/adapters/express-route-adapter";
import { makeSearchGeocodingAddressController } from "../factories/make-search-geocoding-address-controller";

const geocodingRoutes = Router();

geocodingRoutes.post(
  "/search",
  ensureUserIsAuthenticated,
  adaptRoute(makeSearchGeocodingAddressController()),
);

export { geocodingRoutes };
