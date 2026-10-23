import { Router } from "express";
import { userRoutes } from "./users.routes";
import { bookingRoutes } from "./booking.routes";
import { scheduleRoutes } from "./schedule.routes";
import { barbershopRoutes } from "./barbershop.routes";
import { barbershopInvitationRoutes } from "./barbershop-invitation.routes";
import { invitationRoutes } from "./invitation.routes";
import { notificationRoutes } from "./notification.routes";
import { operationAttemptRoutes } from "./operation-attempt.routes";
import { barberRoutes } from "./barber.routes";
import { geocodingRoutes } from "./geocoding.routes";
import { internalRoutes } from "./internal.routes";
import { mediaRoutes } from "./media.routes";
import { reviewsRoutes } from "./reviews.routes";

const routes = Router();

routes.use("/users", userRoutes);
routes.use("/staffs", userRoutes);
routes.use("/invitations", invitationRoutes);
routes.use("/notifications", notificationRoutes);
routes.use("/barbershops", barbershopRoutes);
routes.use("/barbers", barberRoutes);
routes.use("/bookings", bookingRoutes);
routes.use("/media", mediaRoutes);
routes.use("/reviews", reviewsRoutes);
routes.use("/barbershops/:shopId", scheduleRoutes);
routes.use("/barbershops/:shopId", barbershopInvitationRoutes);
routes.use("/operation-attempts", operationAttemptRoutes);
routes.use("/geocoding", geocodingRoutes);
routes.use("/internal", internalRoutes);

export { routes };
