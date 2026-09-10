import { Router } from "express";
import { staffRoutes } from "./staff.routes";
import { scheduleRoutes } from "./schedule.routes";

const routes = Router();

routes.use("/staffs", staffRoutes);
routes.use("/barbershops/:shopId", scheduleRoutes);

export { routes };
