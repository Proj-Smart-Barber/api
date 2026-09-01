import { Router } from "express";
import { staffRoutes } from "./staff.routes";

const routes = Router();

routes.use("/staffs", staffRoutes);

export { routes };
