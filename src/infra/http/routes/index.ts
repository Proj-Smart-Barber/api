import { Router } from "express";
import { staffRoutes } from "./staff.routes";
import { bookingRoutes } from "./booking.routes";
const routes = Router();

routes.use("/staffs", staffRoutes);
routes.use("/booking", bookingRoutes);

export { routes };
