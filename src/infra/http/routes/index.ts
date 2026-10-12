import { Router } from "express";
import { userRoutes } from "./users.routes";
import { bookingRoutes } from "./booking.routes";
import { scheduleRoutes } from "./schedule.routes";
import { barbershopRoutes } from "./barbershop.routes";
import { barbershopInvitationRoutes } from "./barbershop-invitation.routes";
import { invitationRoutes } from "./invitation.routes";
import { notificationRoutes } from "./notification.routes";
import { operationAttemptRoutes } from "./operation-attempt.routes";

const routes = Router();

routes.use("/users", userRoutes);
routes.use("/staffs", userRoutes);
routes.use("/invitations", invitationRoutes);
routes.use("/notifications", notificationRoutes);
routes.use("/barbershops", barbershopRoutes);
routes.use("/bookings", bookingRoutes);
routes.use("/barbershops/:shopId", scheduleRoutes);
routes.use("/barbershops/:shopId", barbershopInvitationRoutes);
routes.use("/operation-attempts", operationAttemptRoutes);

export { routes };
