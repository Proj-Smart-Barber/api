import { Router } from "express";
import { staffRoutes } from "./staff.routes";
import { scheduleRoutes } from "./schedule.routes";
import { barbershopRoutes } from "./barbershop.routes";

const routes = Router();

routes.use("/staffs", staffRoutes);
routes.use("/barbershops", barbershopRoutes);
routes.use("/barbershops/:shopId", scheduleRoutes);

export { routes };
