import { Router } from "express";
import { userRoutes } from "./users.routes";
import { bookingRoutes } from "./booking.routes";
import { scheduleRoutes } from "./schedule.routes";
import { barbershopRoutes } from "./barbershop.routes";

const routes = Router();

routes.use("/users", userRoutes);
routes.use("/barbershops", barbershopRoutes);
routes.use("/bookings", bookingRoutes);
routes.use("/barbershops/:shopId", scheduleRoutes);

export { routes };
